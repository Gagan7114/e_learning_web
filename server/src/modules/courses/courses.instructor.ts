import { Router } from 'express';
import { z } from 'zod';
import { and, eq, asc, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  courses,
  sections,
  lectures,
  enrollments,
  reviews,
  orderItems,
  orders,
  earningTransactions,
} from '../../db/schema.js';
import { asyncHandler, ApiError, uniqueSlug } from '../../utils/helpers.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getCurriculum, recomputeCourseAggregates } from './courses.service.js';

export const instructorCoursesRouter = Router();
instructorCoursesRouter.use(requireAuth, requireRole('instructor'));

/** Load a course and assert the caller owns it. */
async function ownedCourse(courseId: string, instructorId: string) {
  const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
  if (!course) throw new ApiError(404, 'Course not found');
  if (course.instructorId !== instructorId) throw new ApiError(403, 'Not your course');
  return course;
}

/* ---------------- dashboard & earnings ---------------- */

instructorCoursesRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const me = req.user!.sub;
    const myCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.instructorId, me));
    const ids = myCourses.map((c) => c.id);

    const [counts] = await db
      .select({
        totalCourses: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${courses.status} = 'published')::int`,
        students: sql<number>`coalesce(sum(${courses.studentsCount}),0)::int`,
        reviews: sql<number>`coalesce(sum(${courses.ratingCount}),0)::int`,
        avgRating: sql<number>`coalesce(round(avg(nullif(${courses.ratingAvg},0))),0)::int`,
      })
      .from(courses)
      .where(eq(courses.instructorId, me));

    const [earnings] = await db
      .select({
        net: sql<number>`coalesce(sum(${earningTransactions.netCents}),0)::int`,
        gross: sql<number>`coalesce(sum(${earningTransactions.grossCents}),0)::int`,
      })
      .from(earningTransactions)
      .where(eq(earningTransactions.instructorId, me));

    const recentReviews = ids.length
      ? await db
          .select({
            id: reviews.id,
            rating: reviews.rating,
            body: reviews.body,
            courseId: reviews.courseId,
            createdAt: reviews.createdAt,
          })
          .from(reviews)
          .where(inArray(reviews.courseId, ids))
          .orderBy(desc(reviews.createdAt))
          .limit(5)
      : [];

    res.json({ stats: { ...counts, ...earnings }, recentReviews });
  })
);

instructorCoursesRouter.get(
  '/earnings',
  asyncHandler(async (req, res) => {
    const me = req.user!.sub;
    const txns = await db
      .select({
        id: earningTransactions.id,
        grossCents: earningTransactions.grossCents,
        feeCents: earningTransactions.feeCents,
        netCents: earningTransactions.netCents,
        createdAt: earningTransactions.createdAt,
        courseTitle: courses.title,
      })
      .from(earningTransactions)
      .leftJoin(orderItems, eq(earningTransactions.orderItemId, orderItems.id))
      .leftJoin(courses, eq(orderItems.courseId, courses.id))
      .where(eq(earningTransactions.instructorId, me))
      .orderBy(desc(earningTransactions.createdAt))
      .limit(100);
    const [totals] = await db
      .select({
        net: sql<number>`coalesce(sum(${earningTransactions.netCents}),0)::int`,
        gross: sql<number>`coalesce(sum(${earningTransactions.grossCents}),0)::int`,
        fees: sql<number>`coalesce(sum(${earningTransactions.feeCents}),0)::int`,
      })
      .from(earningTransactions)
      .where(eq(earningTransactions.instructorId, me));
    res.json({ transactions: txns, totals });
  })
);

/* ---------------- course CRUD ---------------- */

instructorCoursesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(courses)
      .where(eq(courses.instructorId, req.user!.sub))
      .orderBy(desc(courses.updatedAt));
    res.json({ courses: rows });
  })
);

instructorCoursesRouter.post(
  '/',
  validate({
    body: z.object({
      title: z.string().min(3).max(200),
      categoryId: z.string().uuid().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { title, categoryId } = req.body as { title: string; categoryId?: string };
    const [created] = await db
      .insert(courses)
      .values({
        instructorId: req.user!.sub,
        title,
        slug: uniqueSlug(title),
        categoryId: categoryId ?? null,
        status: 'draft',
      })
      .returning();
    res.status(201).json({ course: created });
  })
);

instructorCoursesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const course = await ownedCourse(req.params.id, req.user!.sub);
    const curriculum = await getCurriculum(course.id, { reveal: true });
    res.json({ course: { ...course, curriculum } });
  })
);

const updateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  subtitle: z.string().max(255).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  topics: z.array(z.string()).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'all']).optional(),
  language: z.string().optional(),
  image: z.string().optional(),
  promoVideo: z.string().optional(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  learningObjectives: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  targetAudience: z.array(z.string()).optional(),
});

instructorCoursesRouter.put(
  '/:id',
  validate({ body: updateSchema }),
  asyncHandler(async (req, res) => {
    await ownedCourse(req.params.id, req.user!.sub);
    const [updated] = await db
      .update(courses)
      .set({ ...(req.body as object), updatedAt: new Date() })
      .where(eq(courses.id, req.params.id))
      .returning();
    res.json({ course: updated });
  })
);

instructorCoursesRouter.post(
  '/:id/submit',
  asyncHandler(async (req, res) => {
    const course = await ownedCourse(req.params.id, req.user!.sub);

    // validation gate
    const problems: string[] = [];
    if (!course.title || course.title.length < 5) problems.push('Title is too short');
    if (!course.subtitle) problems.push('Add a subtitle');
    if (!course.description || course.description.length < 100)
      problems.push('Description must be at least 100 characters');
    if (!course.image) problems.push('Add a course image');
    if (!course.categoryId) problems.push('Pick a category');
    if (!course.learningObjectives || course.learningObjectives.length < 1)
      problems.push('Add at least one learning objective');
    const lectureCount = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(lectures)
      .where(eq(lectures.courseId, course.id));
    if ((lectureCount[0]?.c ?? 0) < 1) problems.push('Add at least one lecture');

    if (problems.length) throw new ApiError(422, 'Course is not ready for review', { problems });

    const [updated] = await db
      .update(courses)
      .set({ status: 'review', updatedAt: new Date() })
      .where(eq(courses.id, course.id))
      .returning();
    res.json({ course: updated });
  })
);

instructorCoursesRouter.post(
  '/:id/unpublish',
  asyncHandler(async (req, res) => {
    const course = await ownedCourse(req.params.id, req.user!.sub);
    const [updated] = await db
      .update(courses)
      .set({ status: 'unpublished', updatedAt: new Date() })
      .where(eq(courses.id, course.id))
      .returning();
    res.json({ course: updated });
  })
);

instructorCoursesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await ownedCourse(req.params.id, req.user!.sub);
    await db.delete(courses).where(eq(courses.id, req.params.id));
    res.json({ ok: true });
  })
);

/* ---------------- sections ---------------- */

instructorCoursesRouter.post(
  '/:id/sections',
  validate({ body: z.object({ title: z.string().min(1).max(200) }) }),
  asyncHandler(async (req, res) => {
    const course = await ownedCourse(req.params.id, req.user!.sub);
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${sections.order}),-1)::int` })
      .from(sections)
      .where(eq(sections.courseId, course.id));
    const [created] = await db
      .insert(sections)
      .values({ courseId: course.id, title: req.body.title, order: max + 1 })
      .returning();
    res.status(201).json({ section: created });
  })
);

instructorCoursesRouter.put(
  '/sections/:sectionId',
  validate({ body: z.object({ title: z.string().min(1).max(200).optional(), order: z.number().int().optional() }) }),
  asyncHandler(async (req, res) => {
    const sec = await db.query.sections.findFirst({ where: eq(sections.id, req.params.sectionId) });
    if (!sec) throw new ApiError(404, 'Section not found');
    await ownedCourse(sec.courseId, req.user!.sub);
    const [updated] = await db
      .update(sections)
      .set(req.body as object)
      .where(eq(sections.id, sec.id))
      .returning();
    res.json({ section: updated });
  })
);

instructorCoursesRouter.delete(
  '/sections/:sectionId',
  asyncHandler(async (req, res) => {
    const sec = await db.query.sections.findFirst({ where: eq(sections.id, req.params.sectionId) });
    if (!sec) throw new ApiError(404, 'Section not found');
    await ownedCourse(sec.courseId, req.user!.sub);
    await db.delete(sections).where(eq(sections.id, sec.id));
    await recomputeCourseAggregates(sec.courseId);
    res.json({ ok: true });
  })
);

/* ---------------- lectures ---------------- */

const lectureSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(['video', 'article', 'quiz', 'assignment']).optional(),
  videoUrl: z.string().optional(),
  articleBody: z.string().optional(),
  durationSec: z.number().int().min(0).optional(),
  isFreePreview: z.boolean().optional(),
});

instructorCoursesRouter.post(
  '/sections/:sectionId/lectures',
  validate({ body: lectureSchema }),
  asyncHandler(async (req, res) => {
    const sec = await db.query.sections.findFirst({ where: eq(sections.id, req.params.sectionId) });
    if (!sec) throw new ApiError(404, 'Section not found');
    await ownedCourse(sec.courseId, req.user!.sub);
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${lectures.order}),-1)::int` })
      .from(lectures)
      .where(eq(lectures.sectionId, sec.id));
    const body = req.body as z.infer<typeof lectureSchema>;
    const [created] = await db
      .insert(lectures)
      .values({
        ...body,
        sectionId: sec.id,
        courseId: sec.courseId,
        order: max + 1,
      })
      .returning();
    await recomputeCourseAggregates(sec.courseId);
    res.status(201).json({ lecture: created });
  })
);

instructorCoursesRouter.put(
  '/lectures/:lectureId',
  validate({ body: lectureSchema.partial() }),
  asyncHandler(async (req, res) => {
    const lec = await db.query.lectures.findFirst({ where: eq(lectures.id, req.params.lectureId) });
    if (!lec) throw new ApiError(404, 'Lecture not found');
    await ownedCourse(lec.courseId, req.user!.sub);
    const [updated] = await db
      .update(lectures)
      .set(req.body as object)
      .where(eq(lectures.id, lec.id))
      .returning();
    await recomputeCourseAggregates(lec.courseId);
    res.json({ lecture: updated });
  })
);

instructorCoursesRouter.delete(
  '/lectures/:lectureId',
  asyncHandler(async (req, res) => {
    const lec = await db.query.lectures.findFirst({ where: eq(lectures.id, req.params.lectureId) });
    if (!lec) throw new ApiError(404, 'Lecture not found');
    await ownedCourse(lec.courseId, req.user!.sub);
    await db.delete(lectures).where(eq(lectures.id, lec.id));
    await recomputeCourseAggregates(lec.courseId);
    res.json({ ok: true });
  })
);
