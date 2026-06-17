/**
 * Drizzle schema — e-learning marketplace (Phase 1 MVP).
 *
 * Modeled on Section 7 of the build spec. Monetary amounts are stored as
 * integers in the currency's minor unit (cents / paise) to avoid float drift.
 */
import {
  pgSchema,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

/**
 * All tables live in a dedicated `elearning` Postgres schema so this app is
 * fully isolated from any other project sharing the same database.
 */
export const mySchema = pgSchema('elearning');
const pgTable = mySchema.table.bind(mySchema);
const pgEnum = mySchema.enum.bind(mySchema);

/* ------------------------------------------------------------------ enums */

export const courseStatusEnum = pgEnum('course_status', [
  'draft',
  'review',
  'published',
  'unpublished',
  'rejected',
]);

export const courseLevelEnum = pgEnum('course_level', [
  'beginner',
  'intermediate',
  'advanced',
  'all',
]);

export const lectureTypeEnum = pgEnum('lecture_type', [
  'video',
  'article',
  'quiz',
  'assignment',
]);

export const enrollmentSourceEnum = pgEnum('enrollment_source', [
  'purchase',
  'free',
  'gift',
  'admin',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'paid',
  'failed',
  'refunded',
]);

export const couponScopeEnum = pgEnum('coupon_scope', ['course', 'platform']);
export const couponTypeEnum = pgEnum('coupon_type', ['percent', 'flat']);

/* ------------------------------------------------------------------ users */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 160 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    avatar: text('avatar'),
    headline: varchar('headline', { length: 255 }),
    bio: text('bio'),
    links: jsonb('links').$type<Record<string, string>>().default({}),
    // a single account can be both student & instructor; admin is separate
    roles: text('roles')
      .array()
      .notNull()
      .default(sql`ARRAY['student']::text[]`),
    locale: varchar('locale', { length: 12 }).notNull().default('en'),
    isVerified: boolean('is_verified').notNull().default(false),
    status: varchar('status', { length: 24 }).notNull().default('active'), // active | suspended | banned
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: unique('users_email_unique').on(t.email),
  })
);

export const instructorProfiles = pgTable('instructor_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  payoutMethod: jsonb('payout_method').$type<Record<string, unknown>>().default({}),
  taxInfo: jsonb('tax_info').$type<Record<string, unknown>>().default({}),
  revenueSharePct: integer('revenue_share_pct').notNull().default(50), // instructor's %
  totalStudents: integer('total_students').notNull().default(0),
  avgRating: integer('avg_rating').notNull().default(0), // stored x100 (e.g. 472 = 4.72)
  approved: boolean('approved').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------- taxonomy */

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 140 }).notNull(),
    parentId: uuid('parent_id').references((): any => categories.id, {
      onDelete: 'set null',
    }),
    description: text('description'),
    icon: varchar('icon', { length: 64 }),
    order: integer('order').notNull().default(0),
  },
  (t) => ({
    slugIdx: unique('categories_slug_unique').on(t.slug),
  })
);

export const topics = pgTable(
  'topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 140 }).notNull(),
  },
  (t) => ({
    slugIdx: unique('topics_slug_unique').on(t.slug),
  })
);

/* --------------------------------------------------------------- courses */

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    subtitle: varchar('subtitle', { length: 255 }),
    slug: varchar('slug', { length: 240 }).notNull(),
    description: text('description'),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    subcategoryId: uuid('subcategory_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    topics: text('topics').array().default(sql`ARRAY[]::text[]`),
    level: courseLevelEnum('level').notNull().default('all'),
    language: varchar('language', { length: 40 }).notNull().default('English'),
    image: text('image'),
    promoVideo: text('promo_video'),
    priceCents: integer('price_cents').notNull().default(0), // 0 = free
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    status: courseStatusEnum('status').notNull().default('draft'),
    ratingAvg: integer('rating_avg').notNull().default(0), // stored x100
    ratingCount: integer('rating_count').notNull().default(0),
    studentsCount: integer('students_count').notNull().default(0),
    durationTotalSec: integer('duration_total_sec').notNull().default(0),
    learningObjectives: text('learning_objectives').array().default(sql`ARRAY[]::text[]`),
    requirements: text('requirements').array().default(sql`ARRAY[]::text[]`),
    targetAudience: text('target_audience').array().default(sql`ARRAY[]::text[]`),
    rejectionNote: text('rejection_note'),
    featured: boolean('featured').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: unique('courses_slug_unique').on(t.slug),
    instructorIdx: index('courses_instructor_idx').on(t.instructorId),
    statusIdx: index('courses_status_idx').on(t.status),
    categoryIdx: index('courses_category_idx').on(t.categoryId),
  })
);

export const sections = pgTable(
  'sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    order: integer('order').notNull().default(0),
  },
  (t) => ({
    courseIdx: index('sections_course_idx').on(t.courseId),
  })
);

export const lectures = pgTable(
  'lectures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sectionId: uuid('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    type: lectureTypeEnum('type').notNull().default('video'),
    // for video: an HLS/MP4 url; for article: rich text/markdown body
    videoUrl: text('video_url'),
    articleBody: text('article_body'),
    durationSec: integer('duration_sec').notNull().default(0),
    isFreePreview: boolean('is_free_preview').notNull().default(false),
    order: integer('order').notNull().default(0),
  },
  (t) => ({
    sectionIdx: index('lectures_section_idx').on(t.sectionId),
    courseIdx: index('lectures_course_idx').on(t.courseId),
  })
);

export const resources = pgTable('resources', {
  id: uuid('id').primaryKey().defaultRandom(),
  lectureId: uuid('lecture_id')
    .notNull()
    .references(() => lectures.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  fileUrl: text('file_url').notNull(),
  type: varchar('type', { length: 40 }),
});

/* ----------------------------------------------------------- quizzes */

export const quizzes = pgTable('quizzes', {
  id: uuid('id').primaryKey().defaultRandom(),
  lectureId: uuid('lecture_id')
    .notNull()
    .references(() => lectures.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull().default('Quiz'),
  passPct: integer('pass_pct').notNull().default(70),
});

export type QuizQuestion = {
  id: string;
  type: 'single' | 'multi' | 'boolean';
  prompt: string;
  options: string[];
  correct: number[]; // indices of correct options
  explanation?: string;
};

export const quizQuestions = pgTable('quiz_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  quizId: uuid('quiz_id')
    .notNull()
    .references(() => quizzes.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 16 }).notNull().default('single'),
  prompt: text('prompt').notNull(),
  options: jsonb('options').$type<string[]>().notNull().default([]),
  correct: jsonb('correct').$type<number[]>().notNull().default([]),
  explanation: text('explanation'),
  order: integer('order').notNull().default(0),
});

/* -------------------------------------------------------- enrollment */

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    source: enrollmentSourceEnum('source').notNull().default('purchase'),
    progressPct: integer('progress_pct').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqUserCourse: unique('enrollments_user_course_unique').on(t.userId, t.courseId),
    userIdx: index('enrollments_user_idx').on(t.userId),
    courseIdx: index('enrollments_course_idx').on(t.courseId),
  })
);

export const progress = pgTable(
  'progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    lectureId: uuid('lecture_id')
      .notNull()
      .references(() => lectures.id, { onDelete: 'cascade' }),
    completed: boolean('completed').notNull().default(false),
    lastPositionSec: integer('last_position_sec').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    uniq: unique('progress_enrollment_lecture_unique').on(t.enrollmentId, t.lectureId),
  })
);

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lectureId: uuid('lecture_id')
    .notNull()
    .references(() => lectures.id, { onDelete: 'cascade' }),
  timestampSec: integer('timestamp_sec').notNull().default(0),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ----------------------------------------------------------- Q&A */

export const qna = pgTable('qna', {
  id: uuid('id').primaryKey().defaultRandom(),
  lectureId: uuid('lecture_id')
    .notNull()
    .references(() => lectures.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  upvotes: integer('upvotes').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const qnaAnswers = pgTable('qna_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  qnaId: uuid('qna_id')
    .notNull()
    .references(() => qna.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------- reviews */

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(), // 1..5
    body: text('body'),
    helpfulCount: integer('helpful_count').notNull().default(0),
    instructorResponse: text('instructor_response'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: unique('reviews_course_user_unique').on(t.courseId, t.userId),
    courseIdx: index('reviews_course_idx').on(t.courseId),
  })
);

/* -------------------------------------------------- cart & wishlist */

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: unique('cart_user_course_unique').on(t.userId, t.courseId),
  })
);

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: unique('wishlist_user_course_unique').on(t.userId, t.courseId),
  })
);

/* -------------------------------------------------------- coupons */

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 40 }).notNull(),
    scope: couponScopeEnum('scope').notNull().default('course'),
    type: couponTypeEnum('type').notNull().default('percent'),
    value: integer('value').notNull(), // percent (0-100) or flat amount in minor units
    maxUses: integer('max_uses'),
    used: integer('used').notNull().default(0),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: unique('coupons_code_unique').on(t.code),
  })
);

/* ----------------------------------------------------- orders / pay */

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  subtotalCents: integer('subtotal_cents').notNull().default(0),
  discountCents: integer('discount_cents').notNull().default(0),
  taxCents: integer('tax_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull().default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  status: orderStatusEnum('status').notNull().default('pending'),
  couponCode: varchar('coupon_code', { length: 40 }),
  provider: varchar('provider', { length: 20 }).notNull().default('mock'), // stripe | razorpay | mock
  paymentRef: varchar('payment_ref', { length: 120 }),
  invoiceUrl: text('invoice_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  instructorId: uuid('instructor_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  priceCents: integer('price_cents').notNull().default(0),
  platformFeeCents: integer('platform_fee_cents').notNull().default(0),
  instructorEarningCents: integer('instructor_earning_cents').notNull().default(0),
});

export const earningTransactions = pgTable('earning_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  instructorId: uuid('instructor_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id')
    .notNull()
    .references(() => orderItems.id, { onDelete: 'cascade' }),
  grossCents: integer('gross_cents').notNull().default(0),
  feeCents: integer('fee_cents').notNull().default(0),
  netCents: integer('net_cents').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const certificates = pgTable('certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  enrollmentId: uuid('enrollment_id')
    .notNull()
    .references(() => enrollments.id, { onDelete: 'cascade' }),
  serial: varchar('serial', { length: 40 }).notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  verifyUrl: text('verify_url'),
});

/* ----------------------------------------------------- notifications */

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 60 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 80 }).notNull(),
  target: varchar('target', { length: 120 }),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ one, many }) => ({
  instructorProfile: one(instructorProfiles, {
    fields: [users.id],
    references: [instructorProfiles.userId],
  }),
  courses: many(courses),
  enrollments: many(enrollments),
  reviews: many(reviews),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  instructor: one(users, {
    fields: [courses.instructorId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [courses.categoryId],
    references: [categories.id],
  }),
  sections: many(sections),
  lectures: many(lectures),
  reviews: many(reviews),
  enrollments: many(enrollments),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  course: one(courses, { fields: [sections.courseId], references: [courses.id] }),
  lectures: many(lectures),
}));

export const lecturesRelations = relations(lectures, ({ one, many }) => ({
  section: one(sections, { fields: [lectures.sectionId], references: [sections.id] }),
  course: one(courses, { fields: [lectures.courseId], references: [courses.id] }),
  resources: many(resources),
  quiz: one(quizzes, { fields: [lectures.id], references: [quizzes.lectureId] }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  lecture: one(lectures, { fields: [quizzes.lectureId], references: [lectures.id] }),
  questions: many(quizQuestions),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, { fields: [quizQuestions.quizId], references: [quizzes.id] }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
  progress: many(progress),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  course: one(courses, { fields: [reviews.courseId], references: [courses.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'parent_child',
  }),
  children: many(categories, { relationName: 'parent_child' }),
  courses: many(courses),
}));

/* ------------------------------------------------------ inferred types */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type Section = typeof sections.$inferSelect;
export type Lecture = typeof lectures.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
