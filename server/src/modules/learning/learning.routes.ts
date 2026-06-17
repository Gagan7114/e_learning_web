import { Router } from 'express';
import { z } from 'zod';
import { and, eq, asc, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  courses,
  sections,
  lectures,
  enrollments,
  progress,
  notes,
  quizzes,
  quizQuestions,
  certificates,
  users,
  notifications,
} from '../../db/schema.js';
import { asyncHandler, ApiError, shortId } from '../../utils/helpers.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';

export const learningRouter = Router();
learningRouter.use(requireAuth);

/** Load the caller's enrollment for a course, or throw 403. */
async function requireEnrollment(userId: string, courseId: string) {
  const e = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
  });
  if (!e) throw new ApiError(403, 'You are not enrolled in this course');
  return e;
}

/** Recompute an enrollment's progress % from completed lectures. */
async function recomputeProgress(enrollmentId: string, courseId: string) {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(lectures)
    .where(eq(lectures.courseId, courseId));
  const [{ done }] = await db
    .select({ done: sql<number>`count(*)::int` })
    .from(progress)
    .where(and(eq(progress.enrollmentId, enrollmentId), eq(progress.completed, true)));
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const completedAt = pct >= 100 ? new Date() : null;
  await db
    .update(enrollments)
    .set({ progressPct: pct, completedAt })
    .where(eq(enrollments.id, enrollmentId));
  return pct;
}

// GET /learning/my-courses
learningRouter.get(
  '/my-courses',
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({
        enrollmentId: enrollments.id,
        progressPct: enrollments.progressPct,
        completedAt: enrollments.completedAt,
        enrolledAt: enrollments.enrolledAt,
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        image: courses.image,
        instructorName: users.name,
        ratingAvg: courses.ratingAvg,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .leftJoin(users, eq(courses.instructorId, users.id))
      .where(eq(enrollments.userId, req.user!.sub))
      .orderBy(desc(enrollments.enrolledAt));
    res.json({ courses: rows });
  })
);

// GET /learning/:slug — full player payload
learningRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const course = await db.query.courses.findFirst({ where: eq(courses.slug, req.params.slug) });
    if (!course) throw new ApiError(404, 'Course not found');
    const enrollment = await requireEnrollment(req.user!.sub, course.id);

    const [secs, lects, prog, hasCert] = await Promise.all([
      db.select().from(sections).where(eq(sections.courseId, course.id)).orderBy(asc(sections.order)),
      db.select().from(lectures).where(eq(lectures.courseId, course.id)).orderBy(asc(lectures.order)),
      db.select().from(progress).where(eq(progress.enrollmentId, enrollment.id)),
      db.query.certificates.findFirst({ where: eq(certificates.enrollmentId, enrollment.id) }),
    ]);

    const progMap = new Map(prog.map((p) => [p.lectureId, p]));
    const curriculum = secs.map((s) => ({
      id: s.id,
      title: s.title,
      lectures: lects
        .filter((l) => l.sectionId === s.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          durationSec: l.durationSec,
          videoUrl: l.videoUrl,
          articleBody: l.articleBody,
          completed: progMap.get(l.id)?.completed ?? false,
          lastPositionSec: progMap.get(l.id)?.lastPositionSec ?? 0,
        })),
    }));

    res.json({
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        instructorId: course.instructorId,
      },
      enrollment: {
        id: enrollment.id,
        progressPct: enrollment.progressPct,
        completedAt: enrollment.completedAt,
      },
      curriculum,
      certificate: hasCert ?? null,
    });
  })
);

// POST /learning/lectures/:lectureId/progress
learningRouter.post(
  '/lectures/:lectureId/progress',
  validate({
    body: z.object({
      completed: z.boolean().optional(),
      lastPositionSec: z.number().int().min(0).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const lec = await db.query.lectures.findFirst({ where: eq(lectures.id, req.params.lectureId) });
    if (!lec) throw new ApiError(404, 'Lecture not found');
    const enrollment = await requireEnrollment(req.user!.sub, lec.courseId);

    const { completed, lastPositionSec } = req.body as {
      completed?: boolean;
      lastPositionSec?: number;
    };

    await db
      .insert(progress)
      .values({
        enrollmentId: enrollment.id,
        lectureId: lec.id,
        completed: completed ?? false,
        lastPositionSec: lastPositionSec ?? 0,
        completedAt: completed ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [progress.enrollmentId, progress.lectureId],
        set: {
          completed: completed ?? sql`${progress.completed}`,
          lastPositionSec: lastPositionSec ?? sql`${progress.lastPositionSec}`,
          completedAt: completed ? new Date() : sql`${progress.completedAt}`,
        },
      });

    const pct = await recomputeProgress(enrollment.id, lec.courseId);
    res.json({ progressPct: pct });
  })
);

/* ----------------------------- notes ----------------------------- */

learningRouter.get(
  '/:courseId/notes',
  asyncHandler(async (req, res) => {
    await requireEnrollment(req.user!.sub, req.params.courseId);
    const courseLectures = await db
      .select({ id: lectures.id })
      .from(lectures)
      .where(eq(lectures.courseId, req.params.courseId));
    const ids = courseLectures.map((l) => l.id);
    if (!ids.length) return res.json({ notes: [] });
    const rows = await db
      .select()
      .from(notes)
      .where(and(eq(notes.userId, req.user!.sub), inArray(notes.lectureId, ids)))
      .orderBy(asc(notes.timestampSec));
    res.json({ notes: rows });
  })
);

learningRouter.post(
  '/notes',
  validate({
    body: z.object({
      lectureId: z.string().uuid(),
      timestampSec: z.number().int().min(0),
      body: z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const lec = await db.query.lectures.findFirst({ where: eq(lectures.id, req.body.lectureId) });
    if (!lec) throw new ApiError(404, 'Lecture not found');
    await requireEnrollment(req.user!.sub, lec.courseId);
    const [created] = await db
      .insert(notes)
      .values({ ...req.body, userId: req.user!.sub })
      .returning();
    res.status(201).json({ note: created });
  })
);

learningRouter.delete(
  '/notes/:id',
  asyncHandler(async (req, res) => {
    await db
      .delete(notes)
      .where(and(eq(notes.id, req.params.id), eq(notes.userId, req.user!.sub)));
    res.json({ ok: true });
  })
);

/* ----------------------------- quiz ----------------------------- */

// GET quiz for a lecture (questions WITHOUT correct answers)
learningRouter.get(
  '/lectures/:lectureId/quiz',
  asyncHandler(async (req, res) => {
    const lec = await db.query.lectures.findFirst({ where: eq(lectures.id, req.params.lectureId) });
    if (!lec) throw new ApiError(404, 'Lecture not found');
    await requireEnrollment(req.user!.sub, lec.courseId);
    const quiz = await db.query.quizzes.findFirst({ where: eq(quizzes.lectureId, lec.id) });
    if (!quiz) throw new ApiError(404, 'No quiz on this lecture');
    const qs = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quiz.id))
      .orderBy(asc(quizQuestions.order));
    res.json({
      quiz: { id: quiz.id, title: quiz.title, passPct: quiz.passPct },
      questions: qs.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, options: q.options })),
    });
  })
);

// POST submit quiz answers -> auto-grade with explanations
learningRouter.post(
  '/quiz/:quizId/submit',
  validate({
    body: z.object({
      answers: z.record(z.array(z.number().int())), // questionId -> selected indices
    }),
  }),
  asyncHandler(async (req, res) => {
    const quiz = await db.query.quizzes.findFirst({ where: eq(quizzes.id, req.params.quizId) });
    if (!quiz) throw new ApiError(404, 'Quiz not found');
    const lec = await db.query.lectures.findFirst({ where: eq(lectures.id, quiz.lectureId) });
    if (lec) await requireEnrollment(req.user!.sub, lec.courseId);

    const qs = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id));
    const answers = (req.body.answers ?? {}) as Record<string, number[]>;

    let correct = 0;
    const results = qs.map((q) => {
      const given = (answers[q.id] ?? []).slice().sort();
      const truth = q.correct.slice().sort();
      const isCorrect =
        given.length === truth.length && given.every((v, i) => v === truth[i]);
      if (isCorrect) correct++;
      return {
        questionId: q.id,
        correct: isCorrect,
        correctAnswers: q.correct,
        explanation: q.explanation,
      };
    });

    const scorePct = qs.length ? Math.round((correct / qs.length) * 100) : 0;
    res.json({ scorePct, passed: scorePct >= quiz.passPct, correct, total: qs.length, results });
  })
);

/* -------------------------- certificate -------------------------- */

learningRouter.post(
  '/:slug/certificate',
  asyncHandler(async (req, res) => {
    const course = await db.query.courses.findFirst({ where: eq(courses.slug, req.params.slug) });
    if (!course) throw new ApiError(404, 'Course not found');
    const enrollment = await requireEnrollment(req.user!.sub, course.id);
    if (enrollment.progressPct < 100)
      throw new ApiError(400, 'Complete 100% of the course to earn your certificate');

    let cert = await db.query.certificates.findFirst({
      where: eq(certificates.enrollmentId, enrollment.id),
    });
    if (!cert) {
      const serial = `CERT-${shortId()}-${shortId()}`;
      [cert] = await db
        .insert(certificates)
        .values({
          enrollmentId: enrollment.id,
          serial,
          verifyUrl: `/verify/${serial}`,
        })
        .returning();
      await db.insert(notifications).values({
        userId: req.user!.sub,
        type: 'certificate_earned',
        payload: { courseId: course.id, courseTitle: course.title, serial },
      });
    }
    res.json({ certificate: cert });
  })
);

// list my certificates
learningRouter.get(
  '/me/certificates',
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({
        id: certificates.id,
        serial: certificates.serial,
        issuedAt: certificates.issuedAt,
        verifyUrl: certificates.verifyUrl,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        userName: users.name,
      })
      .from(certificates)
      .innerJoin(enrollments, eq(certificates.enrollmentId, enrollments.id))
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .innerJoin(users, eq(enrollments.userId, users.id))
      .where(eq(enrollments.userId, req.user!.sub))
      .orderBy(desc(certificates.issuedAt));
    res.json({ certificates: rows });
  })
);

/* ---------------- public certificate verification ---------------- */

export const verifyRouter = Router();
verifyRouter.get(
  '/:serial',
  asyncHandler(async (req, res) => {
    const cert = await db.query.certificates.findFirst({
      where: eq(certificates.serial, req.params.serial),
    });
    if (!cert) throw new ApiError(404, 'Certificate not found');
    const [row] = await db
      .select({
        courseTitle: courses.title,
        userName: users.name,
        issuedAt: certificates.issuedAt,
        serial: certificates.serial,
      })
      .from(certificates)
      .innerJoin(enrollments, eq(certificates.enrollmentId, enrollments.id))
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .innerJoin(users, eq(enrollments.userId, users.id))
      .where(eq(certificates.id, cert.id));
    res.json({ valid: true, certificate: row });
  })
);
