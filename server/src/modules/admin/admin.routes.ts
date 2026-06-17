import { Router } from 'express';
import { z } from 'zod';
import { and, eq, desc, ilike, or, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  users,
  courses,
  orders,
  orderItems,
  reviews,
  enrollments,
  coupons,
  auditLogs,
  instructorProfiles,
  notifications,
} from '../../db/schema.js';
import { asyncHandler, ApiError } from '../../utils/helpers.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

async function audit(
  actorId: string,
  action: string,
  target?: string,
  meta?: Record<string, unknown>
) {
  await db.insert(auditLogs).values({ actorId, action, target, meta: meta ?? {} });
}

/* ----------------------------- dashboard ----------------------------- */

adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const [[userCount], [courseCount], [pending], [gmv], [refunds]] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(users),
      db.select({ c: sql<number>`count(*)::int` }).from(courses),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(courses)
        .where(eq(courses.status, 'review')),
      db
        .select({ sum: sql<number>`coalesce(sum(${orders.totalCents}),0)::int` })
        .from(orders)
        .where(eq(orders.status, 'paid')),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(orders)
        .where(eq(orders.status, 'refunded')),
    ]);

    const topCourses = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        studentsCount: courses.studentsCount,
        ratingAvg: courses.ratingAvg,
      })
      .from(courses)
      .where(eq(courses.status, 'published'))
      .orderBy(desc(courses.studentsCount))
      .limit(5);

    res.json({
      kpis: {
        users: userCount.c,
        courses: courseCount.c,
        pendingReview: pending.c,
        gmvCents: gmv.sum,
        refunds: refunds.c,
      },
      topCourses,
    });
  })
);

/* --------------------------- user management --------------------------- */

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string) ?? '';
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        roles: users.roles,
        status: users.status,
        isVerified: users.isVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(q ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)) : sql`true`)
      .orderBy(desc(users.createdAt))
      .limit(50);
    res.json({ users: rows });
  })
);

adminRouter.post(
  '/users/:id/status',
  validate({ body: z.object({ status: z.enum(['active', 'suspended', 'banned']) }) }),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.sub) throw new ApiError(400, 'You cannot change your own status');
    const [updated] = await db
      .update(users)
      .set({ status: req.body.status })
      .where(eq(users.id, req.params.id))
      .returning();
    if (!updated) throw new ApiError(404, 'User not found');
    await audit(req.user!.sub, 'user.status', req.params.id, { status: req.body.status });
    res.json({ ok: true });
  })
);

adminRouter.post(
  '/users/:id/roles',
  validate({ body: z.object({ roles: z.array(z.string()) }) }),
  asyncHandler(async (req, res) => {
    const [updated] = await db
      .update(users)
      .set({ roles: req.body.roles })
      .where(eq(users.id, req.params.id))
      .returning();
    if (!updated) throw new ApiError(404, 'User not found');
    if (req.body.roles.includes('instructor')) {
      await db
        .insert(instructorProfiles)
        .values({ userId: updated.id })
        .onConflictDoNothing();
    }
    await audit(req.user!.sub, 'user.roles', req.params.id, { roles: req.body.roles });
    res.json({ ok: true });
  })
);

/* ----------------------- course approval queue ----------------------- */

adminRouter.get(
  '/courses',
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        status: courses.status,
        priceCents: courses.priceCents,
        featured: courses.featured,
        studentsCount: courses.studentsCount,
        ratingAvg: courses.ratingAvg,
        createdAt: courses.createdAt,
        instructorName: users.name,
      })
      .from(courses)
      .leftJoin(users, eq(courses.instructorId, users.id))
      .where(status ? eq(courses.status, status as any) : sql`true`)
      .orderBy(desc(courses.updatedAt))
      .limit(100);
    res.json({ courses: rows });
  })
);

adminRouter.post(
  '/courses/:id/approve',
  asyncHandler(async (req, res) => {
    const course = await db.query.courses.findFirst({ where: eq(courses.id, req.params.id) });
    if (!course) throw new ApiError(404, 'Course not found');
    const [updated] = await db
      .update(courses)
      .set({ status: 'published', publishedAt: new Date(), rejectionNote: null, updatedAt: new Date() })
      .where(eq(courses.id, course.id))
      .returning();
    await db.insert(notifications).values({
      userId: course.instructorId,
      type: 'course_approved',
      payload: { courseId: course.id, courseTitle: course.title },
    });
    await audit(req.user!.sub, 'course.approve', course.id);
    res.json({ course: updated });
  })
);

adminRouter.post(
  '/courses/:id/reject',
  validate({ body: z.object({ note: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const course = await db.query.courses.findFirst({ where: eq(courses.id, req.params.id) });
    if (!course) throw new ApiError(404, 'Course not found');
    const [updated] = await db
      .update(courses)
      .set({ status: 'rejected', rejectionNote: req.body.note, updatedAt: new Date() })
      .where(eq(courses.id, course.id))
      .returning();
    await db.insert(notifications).values({
      userId: course.instructorId,
      type: 'course_rejected',
      payload: { courseId: course.id, courseTitle: course.title, note: req.body.note },
    });
    await audit(req.user!.sub, 'course.reject', course.id, { note: req.body.note });
    res.json({ course: updated });
  })
);

adminRouter.post(
  '/courses/:id/feature',
  validate({ body: z.object({ featured: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const [updated] = await db
      .update(courses)
      .set({ featured: req.body.featured })
      .where(eq(courses.id, req.params.id))
      .returning();
    if (!updated) throw new ApiError(404, 'Course not found');
    await audit(req.user!.sub, 'course.feature', req.params.id, { featured: req.body.featured });
    res.json({ course: updated });
  })
);

/* ----------------------------- financials ----------------------------- */

adminRouter.get(
  '/orders',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: orders.id,
        totalCents: orders.totalCents,
        currency: orders.currency,
        status: orders.status,
        provider: orders.provider,
        createdAt: orders.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.createdAt))
      .limit(100);
    res.json({ orders: rows });
  })
);

/* -------------------------- review moderation -------------------------- */

adminRouter.get(
  '/reviews',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        body: reviews.body,
        createdAt: reviews.createdAt,
        userName: users.name,
        courseTitle: courses.title,
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .leftJoin(courses, eq(reviews.courseId, courses.id))
      .orderBy(desc(reviews.createdAt))
      .limit(100);
    res.json({ reviews: rows });
  })
);

adminRouter.delete(
  '/reviews/:id',
  asyncHandler(async (req, res) => {
    const r = await db.query.reviews.findFirst({ where: eq(reviews.id, req.params.id) });
    if (!r) throw new ApiError(404, 'Review not found');
    await db.delete(reviews).where(eq(reviews.id, r.id));
    await audit(req.user!.sub, 'review.remove', req.params.id);
    res.json({ ok: true });
  })
);

/* ----------------------- platform-wide coupons ----------------------- */

adminRouter.post(
  '/coupons',
  validate({
    body: z.object({
      code: z.string().min(3).max(40),
      type: z.enum(['percent', 'flat']),
      value: z.number().int().min(1),
      maxUses: z.number().int().min(1).optional(),
      expiresAt: z.string().datetime().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const [created] = await db
      .insert(coupons)
      .values({
        code: req.body.code.toUpperCase(),
        scope: 'platform',
        type: req.body.type,
        value: req.body.value,
        maxUses: req.body.maxUses ?? null,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      })
      .returning();
    await audit(req.user!.sub, 'coupon.create', created.id, { code: created.code });
    res.status(201).json({ coupon: created });
  })
);

adminRouter.get(
  '/audit-log',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        target: auditLogs.target,
        meta: auditLogs.meta,
        createdAt: auditLogs.createdAt,
        actorName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
    res.json({ logs: rows });
  })
);
