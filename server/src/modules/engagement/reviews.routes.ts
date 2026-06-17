import { Router } from 'express';
import { z } from 'zod';
import { and, eq, desc, asc, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  reviews,
  courses,
  enrollments,
  users,
  qna,
  qnaAnswers,
  lectures,
  notifications,
} from '../../db/schema.js';
import { asyncHandler, ApiError } from '../../utils/helpers.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { recomputeCourseAggregates } from '../courses/courses.service.js';

/* ============================ reviews ============================ */

export const reviewsRouter = Router();

async function requireEnrollment(userId: string, courseId: string) {
  const e = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
  });
  if (!e) throw new ApiError(403, 'Only enrolled students can review this course');
}

// GET my review for a course
reviewsRouter.get(
  '/courses/:slug/my-review',
  requireAuth,
  asyncHandler(async (req, res) => {
    const course = await db.query.courses.findFirst({ where: eq(courses.slug, req.params.slug) });
    if (!course) throw new ApiError(404, 'Course not found');
    const r = await db.query.reviews.findFirst({
      where: and(eq(reviews.courseId, course.id), eq(reviews.userId, req.user!.sub)),
    });
    res.json({ review: r ?? null });
  })
);

// POST/PUT (upsert) a review
reviewsRouter.post(
  '/courses/:slug/reviews',
  requireAuth,
  validate({ body: z.object({ rating: z.number().int().min(1).max(5), body: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const course = await db.query.courses.findFirst({ where: eq(courses.slug, req.params.slug) });
    if (!course) throw new ApiError(404, 'Course not found');
    await requireEnrollment(req.user!.sub, course.id);

    const [review] = await db
      .insert(reviews)
      .values({
        courseId: course.id,
        userId: req.user!.sub,
        rating: req.body.rating,
        body: req.body.body ?? null,
      })
      .onConflictDoUpdate({
        target: [reviews.courseId, reviews.userId],
        set: { rating: req.body.rating, body: req.body.body ?? null },
      })
      .returning();

    await recomputeCourseAggregates(course.id);
    await db.insert(notifications).values({
      userId: course.instructorId,
      type: 'new_review',
      payload: { courseId: course.id, courseTitle: course.title, rating: req.body.rating },
    });
    res.status(201).json({ review });
  })
);

reviewsRouter.delete(
  '/reviews/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await db.query.reviews.findFirst({ where: eq(reviews.id, req.params.id) });
    if (!r) throw new ApiError(404, 'Review not found');
    if (r.userId !== req.user!.sub) throw new ApiError(403, 'Not your review');
    await db.delete(reviews).where(eq(reviews.id, r.id));
    await recomputeCourseAggregates(r.courseId);
    res.json({ ok: true });
  })
);

reviewsRouter.post(
  '/reviews/:id/helpful',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [updated] = await db
      .update(reviews)
      .set({ helpfulCount: sql`${reviews.helpfulCount} + 1` })
      .where(eq(reviews.id, req.params.id))
      .returning();
    if (!updated) throw new ApiError(404, 'Review not found');
    res.json({ helpfulCount: updated.helpfulCount });
  })
);

// instructor responds to a review on their course
reviewsRouter.post(
  '/reviews/:id/respond',
  requireAuth,
  validate({ body: z.object({ response: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const r = await db.query.reviews.findFirst({ where: eq(reviews.id, req.params.id) });
    if (!r) throw new ApiError(404, 'Review not found');
    const course = await db.query.courses.findFirst({ where: eq(courses.id, r.courseId) });
    if (!course || course.instructorId !== req.user!.sub)
      throw new ApiError(403, 'Only the course instructor can respond');
    const [updated] = await db
      .update(reviews)
      .set({ instructorResponse: req.body.response })
      .where(eq(reviews.id, r.id))
      .returning();
    res.json({ review: updated });
  })
);

/* ============================== Q&A ============================== */

export const qnaRouter = Router();
qnaRouter.use(requireAuth);

// GET Q&A for a lecture
qnaRouter.get(
  '/lectures/:lectureId/qna',
  asyncHandler(async (req, res) => {
    const threads = await db
      .select({
        id: qna.id,
        question: qna.question,
        upvotes: qna.upvotes,
        createdAt: qna.createdAt,
        userName: users.name,
        userAvatar: users.avatar,
      })
      .from(qna)
      .leftJoin(users, eq(qna.userId, users.id))
      .where(eq(qna.lectureId, req.params.lectureId))
      .orderBy(desc(qna.upvotes), desc(qna.createdAt));

    const withAnswers = await Promise.all(
      threads.map(async (t) => {
        const answers = await db
          .select({
            id: qnaAnswers.id,
            body: qnaAnswers.body,
            createdAt: qnaAnswers.createdAt,
            userName: users.name,
          })
          .from(qnaAnswers)
          .leftJoin(users, eq(qnaAnswers.userId, users.id))
          .where(eq(qnaAnswers.qnaId, t.id))
          .orderBy(asc(qnaAnswers.createdAt));
        return { ...t, answers };
      })
    );
    res.json({ threads: withAnswers });
  })
);

qnaRouter.post(
  '/lectures/:lectureId/qna',
  validate({ body: z.object({ question: z.string().min(3) }) }),
  asyncHandler(async (req, res) => {
    const lec = await db.query.lectures.findFirst({ where: eq(lectures.id, req.params.lectureId) });
    if (!lec) throw new ApiError(404, 'Lecture not found');
    const [created] = await db
      .insert(qna)
      .values({
        lectureId: lec.id,
        courseId: lec.courseId,
        userId: req.user!.sub,
        question: req.body.question,
      })
      .returning();
    res.status(201).json({ thread: created });
  })
);

qnaRouter.post(
  '/qna/:id/answer',
  validate({ body: z.object({ body: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const thread = await db.query.qna.findFirst({ where: eq(qna.id, req.params.id) });
    if (!thread) throw new ApiError(404, 'Question not found');
    const [answer] = await db
      .insert(qnaAnswers)
      .values({ qnaId: thread.id, userId: req.user!.sub, body: req.body.body })
      .returning();
    // notify the asker
    if (thread.userId !== req.user!.sub) {
      await db.insert(notifications).values({
        userId: thread.userId,
        type: 'qna_answered',
        payload: { qnaId: thread.id, lectureId: thread.lectureId },
      });
    }
    res.status(201).json({ answer });
  })
);

qnaRouter.post(
  '/qna/:id/upvote',
  asyncHandler(async (req, res) => {
    const [updated] = await db
      .update(qna)
      .set({ upvotes: sql`${qna.upvotes} + 1` })
      .where(eq(qna.id, req.params.id))
      .returning();
    if (!updated) throw new ApiError(404, 'Question not found');
    res.json({ upvotes: updated.upvotes });
  })
);
