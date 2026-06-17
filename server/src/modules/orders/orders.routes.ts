import { Router } from 'express';
import { z } from 'zod';
import { and, eq, desc, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  cartItems,
  courses,
  orders,
  orderItems,
  enrollments,
  earningTransactions,
  coupons,
  instructorProfiles,
  notifications,
} from '../../db/schema.js';
import { asyncHandler, ApiError, shortId } from '../../utils/helpers.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { applyCoupon } from './orders.service.js';
import { recomputeCourseAggregates } from '../courses/courses.service.js';
import { env } from '../../env.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

/** Resolve the list of courses to purchase: explicit courseIds (buy-now) or the cart. */
async function resolvePurchaseItems(userId: string, courseIds?: string[]) {
  let ids = courseIds;
  if (!ids || !ids.length) {
    const rows = await db
      .select({ courseId: cartItems.courseId })
      .from(cartItems)
      .where(eq(cartItems.userId, userId));
    ids = rows.map((r) => r.courseId);
  }
  if (!ids.length) throw new ApiError(400, 'Nothing to checkout');

  const list = await db
    .select()
    .from(courses)
    .where(and(inArray(courses.id, ids), eq(courses.status, 'published')));

  // exclude already-owned courses
  const owned = await db
    .select({ courseId: enrollments.courseId })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), inArray(enrollments.courseId, ids)));
  const ownedSet = new Set(owned.map((o) => o.courseId));
  const purchasable = list.filter((c) => !ownedSet.has(c.id));
  if (!purchasable.length) throw new ApiError(400, 'You already own these courses');
  return purchasable;
}

// POST /orders/validate-coupon
ordersRouter.post(
  '/validate-coupon',
  validate({
    body: z.object({ code: z.string().min(1), courseIds: z.array(z.string().uuid()).optional() }),
  }),
  asyncHandler(async (req, res) => {
    const items = await resolvePurchaseItems(req.user!.sub, req.body.courseIds);
    const result = await applyCoupon(
      req.body.code,
      items.map((c) => ({ courseId: c.id, priceCents: c.priceCents }))
    );
    const subtotal = items.reduce((s, c) => s + c.priceCents, 0);
    res.json({ ...result, subtotalCents: subtotal, totalCents: subtotal - result.discountCents });
  })
);

// POST /orders/checkout  — create order, "charge", enroll, split revenue
ordersRouter.post(
  '/checkout',
  validate({
    body: z.object({
      courseIds: z.array(z.string().uuid()).optional(),
      couponCode: z.string().optional(),
      provider: z.enum(['mock', 'stripe', 'razorpay']).optional().default('mock'),
      billing: z
        .object({ name: z.string().optional(), gstin: z.string().optional(), country: z.string().optional() })
        .optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub;
    const { courseIds, couponCode, provider } = req.body as {
      courseIds?: string[];
      couponCode?: string;
      provider: 'mock' | 'stripe' | 'razorpay';
    };

    const items = await resolvePurchaseItems(userId, courseIds);
    const currency = items[0].currency;
    const subtotalCents = items.reduce((s, c) => s + c.priceCents, 0);

    let discountCents = 0;
    let usedCouponId: string | null = null;
    let usedCode: string | null = null;
    if (couponCode) {
      const r = await applyCoupon(
        couponCode,
        items.map((c) => ({ courseId: c.id, priceCents: c.priceCents }))
      );
      discountCents = r.discountCents;
      usedCouponId = r.couponId;
      usedCode = r.code;
    }
    const taxCents = 0; // GST/tax hook — compute per jurisdiction in a later phase
    const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);

    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          userId,
          subtotalCents,
          discountCents,
          taxCents,
          totalCents,
          currency,
          status: 'paid', // mock gateway settles instantly; real providers settle via webhook
          couponCode: usedCode,
          provider,
          paymentRef: `${provider}_${shortId()}`,
          invoiceUrl: null,
        })
        .returning();

      for (const c of items) {
        // revenue split — platform fee vs instructor earning
        const profile = await tx.query.instructorProfiles.findFirst({
          where: eq(instructorProfiles.userId, c.instructorId),
        });
        const instructorPct = profile?.revenueSharePct ?? 100 - env.platformFeePct;
        // distribute the order-level discount proportionally to each item
        const itemNet =
          subtotalCents > 0
            ? Math.round(c.priceCents - (discountCents * c.priceCents) / subtotalCents)
            : 0;
        const instructorEarning = Math.round((itemNet * instructorPct) / 100);
        const platformFee = itemNet - instructorEarning;

        const [oi] = await tx
          .insert(orderItems)
          .values({
            orderId: order.id,
            courseId: c.id,
            instructorId: c.instructorId,
            priceCents: c.priceCents,
            platformFeeCents: platformFee,
            instructorEarningCents: instructorEarning,
          })
          .returning();

        await tx
          .insert(earningTransactions)
          .values({
            instructorId: c.instructorId,
            orderItemId: oi.id,
            grossCents: itemNet,
            feeCents: platformFee,
            netCents: instructorEarning,
          });

        await tx
          .insert(enrollments)
          .values({ userId, courseId: c.id, source: 'purchase' })
          .onConflictDoNothing();

        // notify the instructor
        await tx.insert(notifications).values({
          userId: c.instructorId,
          type: 'new_enrollment',
          payload: { courseId: c.id, courseTitle: c.title },
        });
      }

      if (usedCouponId) {
        await tx
          .update(coupons)
          .set({ used: sql`${coupons.used} + 1` })
          .where(eq(coupons.id, usedCouponId));
      }

      // clear purchased items from cart
      await tx
        .delete(cartItems)
        .where(
          and(
            eq(cartItems.userId, userId),
            inArray(
              cartItems.courseId,
              items.map((c) => c.id)
            )
          )
        );

      return order;
    });

    // refresh students_count for each course (outside the tx is fine)
    await Promise.all(items.map((c) => recomputeCourseAggregates(c.id)));

    res.status(201).json({ order: result, courseSlugs: items.map((c) => c.slug) });
  })
);

// GET /orders — purchase history
ordersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, req.user!.sub))
      .orderBy(desc(orders.createdAt));
    const withItems = await Promise.all(
      rows.map(async (o) => {
        const its = await db
          .select({
            courseId: orderItems.courseId,
            priceCents: orderItems.priceCents,
            title: courses.title,
            slug: courses.slug,
            image: courses.image,
          })
          .from(orderItems)
          .leftJoin(courses, eq(orderItems.courseId, courses.id))
          .where(eq(orderItems.orderId, o.id));
        return { ...o, items: its };
      })
    );
    res.json({ orders: withItems });
  })
);

// GET /orders/:id — receipt
ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await db.query.orders.findFirst({ where: eq(orders.id, req.params.id) });
    if (!order || order.userId !== req.user!.sub) throw new ApiError(404, 'Order not found');
    const its = await db
      .select({
        courseId: orderItems.courseId,
        priceCents: orderItems.priceCents,
        title: courses.title,
        slug: courses.slug,
        image: courses.image,
      })
      .from(orderItems)
      .leftJoin(courses, eq(orderItems.courseId, courses.id))
      .where(eq(orderItems.orderId, order.id));
    res.json({ order: { ...order, items: its } });
  })
);

// POST /orders/:id/refund — 30-day money-back flow (auto-approves within window)
ordersRouter.post(
  '/:id/refund',
  asyncHandler(async (req, res) => {
    const order = await db.query.orders.findFirst({ where: eq(orders.id, req.params.id) });
    if (!order || order.userId !== req.user!.sub) throw new ApiError(404, 'Order not found');
    if (order.status === 'refunded') throw new ApiError(400, 'Order already refunded');

    const ageDays = (Date.now() - new Date(order.createdAt).getTime()) / 86400000;
    if (ageDays > 30) throw new ApiError(400, 'Refund window (30 days) has passed');

    const its = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

    await db.transaction(async (tx) => {
      await tx.update(orders).set({ status: 'refunded' }).where(eq(orders.id, order.id));
      for (const it of its) {
        // un-enroll & reverse instructor earnings
        await tx
          .delete(enrollments)
          .where(
            and(eq(enrollments.userId, order.userId), eq(enrollments.courseId, it.courseId))
          );
        await tx.insert(earningTransactions).values({
          instructorId: it.instructorId,
          orderItemId: it.id,
          grossCents: -it.priceCents,
          feeCents: -it.platformFeeCents,
          netCents: -it.instructorEarningCents,
        });
      }
    });

    await Promise.all(its.map((it) => recomputeCourseAggregates(it.courseId)));
    res.json({ ok: true, refunded: order.totalCents });
  })
);
