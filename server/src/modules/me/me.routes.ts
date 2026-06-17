import { Router } from 'express';
import { z } from 'zod';
import { and, eq, desc, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, notifications, coupons, courses } from '../../db/schema.js';
import { asyncHandler, ApiError } from '../../utils/helpers.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const meRouter = Router();
meRouter.use(requireAuth);

/* -------------------------- account settings -------------------------- */

meRouter.put(
  '/profile',
  validate({
    body: z.object({
      name: z.string().min(2).max(160).optional(),
      headline: z.string().max(255).optional(),
      bio: z.string().optional(),
      avatar: z.string().optional(),
      links: z.record(z.string()).optional(),
      locale: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const [updated] = await db
      .update(users)
      .set({ ...(req.body as object), updatedAt: new Date() })
      .where(eq(users.id, req.user!.sub))
      .returning();
    res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        avatar: updated.avatar,
        headline: updated.headline,
        bio: updated.bio,
        links: updated.links,
        roles: updated.roles,
        locale: updated.locale,
      },
    });
  })
);

/* -------------------------- notifications -------------------------- */

meRouter.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.user!.sub))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    const [{ unread }] = await db
      .select({ unread: sql<number>`count(*) filter (where ${notifications.read} = false)::int` })
      .from(notifications)
      .where(eq(notifications.userId, req.user!.sub));
    res.json({ notifications: rows, unread });
  })
);

meRouter.post(
  '/notifications/:id/read',
  asyncHandler(async (req, res) => {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.user!.sub)));
    res.json({ ok: true });
  })
);

meRouter.post(
  '/notifications/read-all',
  asyncHandler(async (req, res) => {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, req.user!.sub));
    res.json({ ok: true });
  })
);

/* ----------------------- instructor coupons ----------------------- */

export const couponsRouter = Router();
couponsRouter.use(requireAuth, requireRole('instructor'));

// list coupons for my courses
couponsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({
        id: coupons.id,
        code: coupons.code,
        type: coupons.type,
        value: coupons.value,
        maxUses: coupons.maxUses,
        used: coupons.used,
        expiresAt: coupons.expiresAt,
        active: coupons.active,
        courseId: coupons.courseId,
        courseTitle: courses.title,
      })
      .from(coupons)
      .innerJoin(courses, eq(coupons.courseId, courses.id))
      .where(eq(courses.instructorId, req.user!.sub))
      .orderBy(desc(coupons.createdAt));
    res.json({ coupons: rows });
  })
);

couponsRouter.post(
  '/',
  validate({
    body: z.object({
      code: z.string().min(3).max(40),
      courseId: z.string().uuid(),
      type: z.enum(['percent', 'flat']),
      value: z.number().int().min(1),
      maxUses: z.number().int().min(1).optional(),
      expiresAt: z.string().datetime().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const course = await db.query.courses.findFirst({ where: eq(courses.id, req.body.courseId) });
    if (!course || course.instructorId !== req.user!.sub)
      throw new ApiError(403, 'You can only create coupons for your own courses');
    if (req.body.type === 'percent' && req.body.value > 100)
      throw new ApiError(400, 'Percent discount cannot exceed 100');
    const [created] = await db
      .insert(coupons)
      .values({
        code: req.body.code.toUpperCase(),
        scope: 'course',
        type: req.body.type,
        value: req.body.value,
        maxUses: req.body.maxUses ?? null,
        courseId: req.body.courseId,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      })
      .returning();
    res.status(201).json({ coupon: created });
  })
);

couponsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const coupon = await db.query.coupons.findFirst({ where: eq(coupons.id, req.params.id) });
    if (!coupon?.courseId) throw new ApiError(404, 'Coupon not found');
    const course = await db.query.courses.findFirst({ where: eq(courses.id, coupon.courseId) });
    if (!course || course.instructorId !== req.user!.sub) throw new ApiError(403, 'Not allowed');
    await db.delete(coupons).where(eq(coupons.id, coupon.id));
    res.json({ ok: true });
  })
);
