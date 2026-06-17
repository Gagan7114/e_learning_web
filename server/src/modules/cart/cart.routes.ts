import { Router } from 'express';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cartItems, wishlistItems, courses, users, enrollments } from '../../db/schema.js';
import { asyncHandler, ApiError } from '../../utils/helpers.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';

export const cartRouter = Router();
cartRouter.use(requireAuth);

const cardSelect = {
  id: courses.id,
  title: courses.title,
  slug: courses.slug,
  image: courses.image,
  priceCents: courses.priceCents,
  currency: courses.currency,
  ratingAvg: courses.ratingAvg,
  ratingCount: courses.ratingCount,
  level: courses.level,
  instructorName: users.name,
};

async function loadCourseCards(courseIds: string[]) {
  if (!courseIds.length) return [];
  return db
    .select(cardSelect)
    .from(courses)
    .leftJoin(users, eq(courses.instructorId, users.id))
    .where(inArray(courses.id, courseIds));
}

/* ----------------------------- cart ----------------------------- */

cartRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({ courseId: cartItems.courseId })
      .from(cartItems)
      .where(eq(cartItems.userId, req.user!.sub));
    const items = await loadCourseCards(rows.map((r) => r.courseId));
    const subtotalCents = items.reduce((s, c) => s + c.priceCents, 0);
    res.json({ items, subtotalCents });
  })
);

cartRouter.post(
  '/',
  validate({ body: z.object({ courseId: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { courseId } = req.body as { courseId: string };
    const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
    if (!course || course.status !== 'published') throw new ApiError(404, 'Course not available');

    const already = await db.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, req.user!.sub), eq(enrollments.courseId, courseId)),
    });
    if (already) throw new ApiError(409, 'You already own this course');

    await db
      .insert(cartItems)
      .values({ userId: req.user!.sub, courseId })
      .onConflictDoNothing();
    res.status(201).json({ ok: true });
  })
);

cartRouter.delete(
  '/:courseId',
  asyncHandler(async (req, res) => {
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.userId, req.user!.sub), eq(cartItems.courseId, req.params.courseId)));
    res.json({ ok: true });
  })
);

/* --------------------------- wishlist --------------------------- */

cartRouter.get(
  '/wishlist',
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({ courseId: wishlistItems.courseId })
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, req.user!.sub));
    const items = await loadCourseCards(rows.map((r) => r.courseId));
    res.json({ items });
  })
);

cartRouter.post(
  '/wishlist',
  validate({ body: z.object({ courseId: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    await db
      .insert(wishlistItems)
      .values({ userId: req.user!.sub, courseId: req.body.courseId })
      .onConflictDoNothing();
    res.status(201).json({ ok: true });
  })
);

cartRouter.delete(
  '/wishlist/:courseId',
  asyncHandler(async (req, res) => {
    await db
      .delete(wishlistItems)
      .where(
        and(eq(wishlistItems.userId, req.user!.sub), eq(wishlistItems.courseId, req.params.courseId))
      );
    res.json({ ok: true });
  })
);
