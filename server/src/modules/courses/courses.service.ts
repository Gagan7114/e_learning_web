import { and, eq, asc, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  courses,
  sections,
  lectures,
  users,
  reviews,
  enrollments,
} from '../../db/schema.js';

/** Lightweight public shape of an instructor. */
export async function getInstructorCard(instructorId: string) {
  const u = await db.query.users.findFirst({ where: eq(users.id, instructorId) });
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    headline: u.headline,
    bio: u.bio,
  };
}

/** Build the curriculum tree (sections -> lectures) for a course. */
export async function getCurriculum(courseId: string, opts: { reveal: boolean }) {
  const secs = await db
    .select()
    .from(sections)
    .where(eq(sections.courseId, courseId))
    .orderBy(asc(sections.order));
  const lects = await db
    .select()
    .from(lectures)
    .where(eq(lectures.courseId, courseId))
    .orderBy(asc(lectures.order));

  return secs.map((s) => ({
    id: s.id,
    title: s.title,
    order: s.order,
    lectures: lects
      .filter((l) => l.sectionId === s.id)
      .map((l) => {
        const canSee = opts.reveal || l.isFreePreview;
        return {
          id: l.id,
          title: l.title,
          type: l.type,
          durationSec: l.durationSec,
          isFreePreview: l.isFreePreview,
          order: l.order,
          // gate paid content: only expose body/url to enrolled users / owner / free previews
          videoUrl: canSee ? l.videoUrl : null,
          articleBody: canSee ? l.articleBody : null,
          locked: !canSee,
        };
      }),
  }));
}

/** Rating distribution (1..5 -> count) for a course. */
export async function getRatingBreakdown(courseId: string) {
  const rows = await db
    .select({ rating: reviews.rating, count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(eq(reviews.courseId, courseId))
    .groupBy(reviews.rating);
  const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rows) breakdown[r.rating] = r.count;
  return breakdown;
}

/** Is this user enrolled in this course? */
export async function isEnrolled(userId: string | undefined, courseId: string) {
  if (!userId) return false;
  const e = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
  });
  return Boolean(e);
}

/** Recompute and persist a course's aggregate rating + duration + students count. */
export async function recomputeCourseAggregates(courseId: string) {
  const [agg] = await db
    .select({
      avg: sql<number>`coalesce(round(avg(${reviews.rating}) * 100), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(eq(reviews.courseId, courseId));

  const [dur] = await db
    .select({ total: sql<number>`coalesce(sum(${lectures.durationSec}), 0)::int` })
    .from(lectures)
    .where(eq(lectures.courseId, courseId));

  const [stu] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId));

  await db
    .update(courses)
    .set({
      ratingAvg: agg?.avg ?? 0,
      ratingCount: agg?.count ?? 0,
      durationTotalSec: dur?.total ?? 0,
      studentsCount: stu?.count ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, courseId));
}
