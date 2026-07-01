/**
 * Add a single published "Deep Learning" course that plays a real YouTube video.
 * This APPENDS to the existing data (it does not truncate like seed.ts).
 *
 * Run from the server workspace:
 *   npx tsx src/db/add-deep-learning.ts
 * or from the repo root:
 *   npm run db:add-deep-learning
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from './index.js';
import { users, categories, courses, sections, lectures, enrollments } from './schema.js';
import { uniqueSlug } from '../utils/helpers.js';
import { recomputeCourseAggregates } from '../modules/courses/courses.service.js';

// The YouTube lecture you wanted to use.
const YT = 'https://www.youtube.com/watch?v=G1P2IaBcXx8';

async function main() {
  // Instructor: prefer David (the ML instructor); fall back to any instructor / admin.
  const instructor =
    (await db.query.users.findFirst({ where: eq(users.email, 'david@e-learning.dev') })) ??
    (await db.query.users.findFirst({ where: eq(users.email, 'admin@e-learning.dev') }));
  if (!instructor) throw new Error('No instructor found — run `npm run db:seed` first.');

  // Categories (created by the seed). Deep Learning fits Development > Data Science.
  const category = await db.query.categories.findFirst({ where: eq(categories.slug, 'development') });
  const subcategory = await db.query.categories.findFirst({ where: eq(categories.slug, 'data-science') });

  console.log('· Creating the Deep Learning course…');
  const [course] = await db
    .insert(courses)
    .values({
      instructorId: instructor.id,
      title: 'Deep Learning Masterclass: Neural Networks from Scratch',
      subtitle: 'Understand neural networks, backpropagation, CNNs and more — with hands-on intuition',
      slug: uniqueSlug('Deep Learning Masterclass'),
      description:
        '<p>A complete, beginner-friendly introduction to deep learning.</p>' +
        '<p>You will learn how neural networks actually work — neurons, activation functions, ' +
        'forward and backward propagation, gradient descent, and how to train models that recognize ' +
        'images and text. Every concept is taught with clear visual intuition before any math.</p>' +
        '<p>By the end you will understand the building blocks behind modern AI and be ready to build your own models.</p>',
      categoryId: category?.id ?? null,
      subcategoryId: subcategory?.id ?? null,
      topics: ['Deep Learning', 'Neural Networks', 'Machine Learning'],
      level: 'all',
      language: 'English',
      image: 'https://picsum.photos/seed/deep-learning/640/360',
      promoVideo: YT,
      priceCents: 0, // free → anyone can enroll and watch in the full player
      currency: 'INR',
      status: 'published',
      publishedAt: new Date(),
      learningObjectives: [
        'Understand how a neural network learns',
        'Master backpropagation and gradient descent intuitively',
        'Know when to use CNNs, RNNs and transformers',
        'Train and evaluate your first deep learning model',
      ],
      requirements: ['Basic Python helps but is not required', 'Curiosity about how AI works'],
      targetAudience: ['Beginners curious about AI', 'Developers moving into ML', 'Students and data enthusiasts'],
      featured: true,
    })
    .returning();

  console.log('· Adding section + lectures…');
  const [section] = await db
    .insert(sections)
    .values({ courseId: course.id, title: 'Deep Learning Foundations', order: 0 })
    .returning();

  const lectureDefs = [
    { title: 'Introduction to Deep Learning', durationSec: 900, isFreePreview: true },
    { title: 'How Neural Networks Learn', durationSec: 900, isFreePreview: false },
    { title: 'Training Your First Model', durationSec: 900, isFreePreview: false },
  ];
  let order = 0;
  for (const l of lectureDefs) {
    await db.insert(lectures).values({
      sectionId: section.id,
      courseId: course.id,
      title: l.title,
      type: 'video',
      videoUrl: YT, // same YouTube video for every lecture
      durationSec: l.durationSec,
      isFreePreview: l.isFreePreview,
      order: order++,
    });
  }

  // Enroll Alex so it appears in My Learning and plays in the full player immediately.
  const alex = await db.query.users.findFirst({ where: eq(users.email, 'alex@e-learning.dev') });
  if (alex) {
    await db
      .insert(enrollments)
      .values({ userId: alex.id, courseId: course.id, source: 'free' })
      .onConflictDoNothing();
    console.log('· Enrolled alex@e-learning.dev');
  }

  await recomputeCourseAggregates(course.id);

  console.log('\n✓ Done!');
  console.log(`  Course: ${course.title}`);
  console.log(`  Instructor: ${instructor.email}`);
  console.log(`  Landing page: /course/${course.slug}`);
  console.log(`  Player (enroll first / log in as alex): /learn/${course.slug}`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Failed:', err);
    pool.end();
    process.exit(1);
  });
