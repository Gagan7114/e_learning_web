import { Router } from 'express';
import { z } from 'zod';
import { and, eq, ne, gt, gte, desc, asc, ilike, or, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { courses, users, categories, reviews } from '../../db/schema.js';
import { asyncHandler, ApiError } from '../../utils/helpers.js';
import { optionalAuth } from '../../middleware/auth.js';
import {
  getCurriculum,
  getRatingBreakdown,
  getInstructorCard,
  isEnrolled,
} from './courses.service.js';

export const coursesPublicRouter = Router();

/** Public card projection for catalog listings. */
const cardColumns = {
  id: courses.id,
  title: courses.title,
  subtitle: courses.subtitle,
  slug: courses.slug,
  image: courses.image,
  priceCents: courses.priceCents,
  currency: courses.currency,
  level: courses.level,
  language: courses.language,
  ratingAvg: courses.ratingAvg,
  ratingCount: courses.ratingCount,
  studentsCount: courses.studentsCount,
  durationTotalSec: courses.durationTotalSec,
  featured: courses.featured,
  categoryId: courses.categoryId,
  instructorId: courses.instructorId,
  instructorName: users.name,
  publishedAt: courses.publishedAt,
};

const listQuery = z.object({
  q: z.string().optional(),
  category: z.string().optional(), // slug
  subcategory: z.string().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'all']).optional(),
  price: z.enum(['free', 'paid']).optional(),
  language: z.string().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  sort: z
    .enum(['relevant', 'rating', 'newest', 'enrolled', 'price_asc', 'price_desc'])
    .optional()
    .default('relevant'),
  featured: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(48).optional().default(12),
});

// GET /courses  — faceted catalog & search (published only)
coursesPublicRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const p = listQuery.parse(req.query);
    const filters = [eq(courses.status, 'published')];

    if (p.q) {
      filters.push(
        or(
          ilike(courses.title, `%${p.q}%`),
          ilike(courses.subtitle, `%${p.q}%`),
          ilike(courses.description, `%${p.q}%`)
        )!
      );
    }
    if (p.category) {
      const cat = await db.query.categories.findFirst({ where: eq(categories.slug, p.category) });
      if (cat) filters.push(eq(courses.categoryId, cat.id));
      else filters.push(sql`false`);
    }
    if (p.subcategory) {
      const sub = await db.query.categories.findFirst({
        where: eq(categories.slug, p.subcategory),
      });
      if (sub) filters.push(eq(courses.subcategoryId, sub.id));
    }
    if (p.level && p.level !== 'all') filters.push(eq(courses.level, p.level));
    if (p.price === 'free') filters.push(eq(courses.priceCents, 0));
    if (p.price === 'paid') filters.push(gt(courses.priceCents, 0));
    if (p.language) filters.push(eq(courses.language, p.language));
    if (p.rating) filters.push(gte(courses.ratingAvg, Math.round(p.rating * 100)));
    if (p.featured) filters.push(eq(courses.featured, true));

    const where = and(...filters);

    const orderBy = {
      rating: [desc(courses.ratingAvg), desc(courses.ratingCount)],
      newest: [desc(courses.publishedAt)],
      enrolled: [desc(courses.studentsCount)],
      price_asc: [asc(courses.priceCents)],
      price_desc: [desc(courses.priceCents)],
      relevant: [desc(courses.featured), desc(courses.studentsCount), desc(courses.ratingAvg)],
    }[p.sort];

    const offset = (p.page - 1) * p.limit;

    const [items, [{ count }]] = await Promise.all([
      db
        .select(cardColumns)
        .from(courses)
        .leftJoin(users, eq(courses.instructorId, users.id))
        .where(where)
        .orderBy(...orderBy)
        .limit(p.limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(courses).where(where),
    ]);

    res.json({
      items,
      page: p.page,
      limit: p.limit,
      total: count,
      totalPages: Math.ceil(count / p.limit),
    });
  })
);

// GET /courses/facets — distinct languages/levels for filter UI
coursesPublicRouter.get(
  '/facets',
  asyncHandler(async (_req, res) => {
    const langs = await db
      .selectDistinct({ language: courses.language })
      .from(courses)
      .where(eq(courses.status, 'published'));
    res.json({
      languages: langs.map((l) => l.language).filter(Boolean),
      levels: ['beginner', 'intermediate', 'advanced'],
    });
  })
);

// GET /courses/:slug — full landing page detail
coursesPublicRouter.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const course = await db.query.courses.findFirst({
      where: eq(courses.slug, req.params.slug),
    });
    if (!course) throw new ApiError(404, 'Course not found');

    const userId = req.user?.sub;
    const enrolled = await isEnrolled(userId, course.id);
    const isOwner = userId === course.instructorId;
    const isAdmin = req.user?.roles.includes('admin') ?? false;

    if (course.status !== 'published' && !isOwner && !isAdmin) {
      throw new ApiError(404, 'Course not found');
    }

    const reveal = enrolled || isOwner || isAdmin;
    const [curriculum, breakdown, instructor, cat] = await Promise.all([
      getCurriculum(course.id, { reveal }),
      getRatingBreakdown(course.id),
      getInstructorCard(course.instructorId),
      course.categoryId
        ? db.query.categories.findFirst({ where: eq(categories.id, course.categoryId) })
        : Promise.resolve(null),
    ]);

    const lectureCount = curriculum.reduce((n, s) => n + s.lectures.length, 0);

    res.json({
      course: {
        ...course,
        category: cat ?? null,
        instructor,
        curriculum,
        ratingBreakdown: breakdown,
        lectureCount,
        sectionCount: curriculum.length,
        enrolled,
        isOwner,
      },
    });
  })
);

// GET /courses/:slug/reviews — paginated reviews
coursesPublicRouter.get(
  '/:slug/reviews',
  asyncHandler(async (req, res) => {
    const course = await db.query.courses.findFirst({ where: eq(courses.slug, req.params.slug) });
    if (!course) throw new ApiError(404, 'Course not found');
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = 10;
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        body: reviews.body,
        helpfulCount: reviews.helpfulCount,
        instructorResponse: reviews.instructorResponse,
        createdAt: reviews.createdAt,
        userName: users.name,
        userAvatar: users.avatar,
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.courseId, course.id))
      .orderBy(desc(reviews.helpfulCount), desc(reviews.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
    res.json({ reviews: rows, page });
  })
);

// GET /courses/:slug/related — students also bought (same category)
coursesPublicRouter.get(
  '/:slug/related',
  asyncHandler(async (req, res) => {
    const course = await db.query.courses.findFirst({ where: eq(courses.slug, req.params.slug) });
    if (!course) throw new ApiError(404, 'Course not found');
    const filters = [eq(courses.status, 'published'), ne(courses.id, course.id)];
    if (course.categoryId) filters.push(eq(courses.categoryId, course.categoryId));
    const items = await db
      .select(cardColumns)
      .from(courses)
      .leftJoin(users, eq(courses.instructorId, users.id))
      .where(and(...filters))
      .orderBy(desc(courses.studentsCount))
      .limit(6);
    res.json({ items });
  })
);

// GET /instructors/:id — public instructor profile + their published courses
export const instructorPublicRouter = Router();
instructorPublicRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const instructor = await getInstructorCard(req.params.id);
    if (!instructor) throw new ApiError(404, 'Instructor not found');
    const items = await db
      .select(cardColumns)
      .from(courses)
      .leftJoin(users, eq(courses.instructorId, users.id))
      .where(and(eq(courses.instructorId, req.params.id), eq(courses.status, 'published')))
      .orderBy(desc(courses.studentsCount));
    const [agg] = await db
      .select({
        students: sql<number>`coalesce(sum(${courses.studentsCount}),0)::int`,
        reviews: sql<number>`coalesce(sum(${courses.ratingCount}),0)::int`,
        rating: sql<number>`coalesce(round(avg(nullif(${courses.ratingAvg},0))),0)::int`,
      })
      .from(courses)
      .where(and(eq(courses.instructorId, req.params.id), eq(courses.status, 'published')));
    res.json({ instructor: { ...instructor, stats: agg }, courses: items });
  })
);

// helper exported for reuse
export { cardColumns };
