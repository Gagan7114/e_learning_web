/**
 * Seed the e-learning database with a realistic marketplace:
 * admin + instructors + students, a category tree, several published
 * courses with full curricula, reviews, enrollments and a coupon.
 *
 * Run with: npm run db:seed   (from server/, or `npm run db:seed` at root)
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db, pool } from './index.js';
import {
  users,
  instructorProfiles,
  categories,
  courses,
  sections,
  lectures,
  quizzes,
  quizQuestions,
  reviews,
  enrollments,
  coupons,
} from './schema.js';
import { hashPassword } from '../utils/password.js';
import { slugify, uniqueSlug } from '../utils/helpers.js';
import { recomputeCourseAggregates } from '../modules/courses/courses.service.js';

const SAMPLE_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
];

function img(seed: string) {
  return `https://picsum.photos/seed/${seed}/640/360`;
}

async function reset() {
  console.log('· Truncating tables…');
  await db.execute(sql`
    TRUNCATE TABLE
      elearning.audit_logs, elearning.notifications, elearning.certificates,
      elearning.earning_transactions, elearning.order_items, elearning.orders,
      elearning.coupons, elearning.wishlist_items, elearning.cart_items,
      elearning.reviews, elearning.qna_answers, elearning.qna, elearning.notes,
      elearning.progress, elearning.enrollments, elearning.quiz_questions,
      elearning.quizzes, elearning.resources, elearning.lectures,
      elearning.sections, elearning.courses, elearning.topics,
      elearning.categories, elearning.instructor_profiles, elearning.users
    RESTART IDENTITY CASCADE
  `);
}

async function main() {
  await reset();
  const pw = await hashPassword('Password123!');

  console.log('· Creating users…');
  const [admin] = await db
    .insert(users)
    .values({
      name: 'Platform Admin',
      email: 'admin@e-learning.dev',
      passwordHash: pw,
      roles: ['student', 'instructor', 'admin'],
      isVerified: true,
      headline: 'e-learning staff',
    })
    .returning();

  const instructorsData = [
    { name: 'Sarah Chen', email: 'sarah@e-learning.dev', headline: 'Senior Web Engineer & Educator', bio: 'Full-stack engineer with 12 years of experience teaching React, Node and TypeScript.' },
    { name: 'David Kumar', email: 'david@e-learning.dev', headline: 'Data Scientist & ML Instructor', bio: 'PhD in ML. I make data science approachable for everyone.' },
    { name: 'Maria Lopez', email: 'maria@e-learning.dev', headline: 'Product Designer', bio: 'Design lead helping people build beautiful, usable products.' },
  ];
  const instructors = [];
  for (const d of instructorsData) {
    const [u] = await db
      .insert(users)
      .values({ ...d, passwordHash: pw, roles: ['student', 'instructor'], isVerified: true, avatar: img(`av-${slugify(d.name)}`) })
      .returning();
    await db.insert(instructorProfiles).values({ userId: u.id, revenueSharePct: 50, approved: true });
    instructors.push(u);
  }

  const studentsData = [
    { name: 'Alex Johnson', email: 'alex@e-learning.dev' },
    { name: 'Priya Sharma', email: 'priya@e-learning.dev' },
    { name: 'Tom Baker', email: 'tom@e-learning.dev' },
  ];
  const students = [];
  for (const d of studentsData) {
    const [u] = await db
      .insert(users)
      .values({ ...d, passwordHash: pw, roles: ['student'], isVerified: true })
      .returning();
    students.push(u);
  }

  console.log('· Creating categories…');
  const catTree: { name: string; icon: string; subs: string[] }[] = [
    { name: 'Development', icon: '💻', subs: ['Web Development', 'Data Science', 'Mobile Development', 'Programming Languages'] },
    { name: 'Business', icon: '📈', subs: ['Entrepreneurship', 'Management', 'Sales'] },
    { name: 'Design', icon: '🎨', subs: ['UX Design', 'Graphic Design', 'Design Tools'] },
    { name: 'Marketing', icon: '📣', subs: ['Digital Marketing', 'SEO', 'Content Marketing'] },
    { name: 'IT & Software', icon: '🖥️', subs: ['IT Certifications', 'Network & Security', 'Cloud Computing'] },
  ];
  const catMap = new Map<string, string>();
  let order = 0;
  for (const c of catTree) {
    const [parent] = await db
      .insert(categories)
      .values({ name: c.name, slug: slugify(c.name), icon: c.icon, order: order++ })
      .returning();
    catMap.set(c.name, parent.id);
    let so = 0;
    for (const s of c.subs) {
      const [sub] = await db
        .insert(categories)
        .values({ name: s, slug: slugify(s), parentId: parent.id, order: so++ })
        .returning();
      catMap.set(s, sub.id);
    }
  }

  console.log('· Creating courses…');
  type CourseDef = {
    instructor: number;
    title: string;
    subtitle: string;
    category: string;
    subcategory: string;
    level: 'beginner' | 'intermediate' | 'advanced' | 'all';
    priceCents: number;
    objectives: string[];
    requirements: string[];
    audience: string[];
    sections: { title: string; lectures: { title: string; durationSec: number; free?: boolean }[] }[];
    featured?: boolean;
  };

  const defs: CourseDef[] = [
    {
      instructor: 0,
      title: 'The Complete React Developer Course',
      subtitle: 'Build modern, reactive web apps with React, Hooks, Router and TypeScript',
      category: 'Development',
      subcategory: 'Web Development',
      level: 'all',
      priceCents: 1999900,
      featured: true,
      objectives: ['Build production React apps from scratch', 'Master Hooks and component patterns', 'Use TypeScript with React', 'Manage state with context and stores', 'Deploy to production'],
      requirements: ['Basic HTML, CSS and JavaScript', 'A computer with internet access'],
      audience: ['Beginners wanting to learn React', 'JS developers leveling up', 'Anyone building web apps'],
      sections: [
        { title: 'Getting Started', lectures: [
          { title: 'Course Introduction', durationSec: 240, free: true },
          { title: 'Setting up your environment', durationSec: 480, free: true },
          { title: 'Your first component', durationSec: 600 },
        ] },
        { title: 'React Fundamentals', lectures: [
          { title: 'JSX deep dive', durationSec: 720 },
          { title: 'Props and state', durationSec: 900 },
          { title: 'Handling events', durationSec: 540 },
          { title: 'Knowledge check', durationSec: 0 },
        ] },
        { title: 'Hooks in Depth', lectures: [
          { title: 'useState and useEffect', durationSec: 1080 },
          { title: 'Custom hooks', durationSec: 840 },
          { title: 'useMemo and useCallback', durationSec: 660 },
        ] },
      ],
    },
    {
      instructor: 0,
      title: 'Node.js & Express REST API Masterclass',
      subtitle: 'Design, build and secure production REST APIs with Node, Express and Postgres',
      category: 'Development',
      subcategory: 'Web Development',
      level: 'intermediate',
      priceCents: 1499900,
      objectives: ['Build RESTful APIs with Express', 'Authentication with JWT', 'Work with PostgreSQL', 'Write tests and deploy'],
      requirements: ['JavaScript fundamentals', 'Basic command-line skills'],
      audience: ['Frontend devs moving to backend', 'Bootcamp grads'],
      sections: [
        { title: 'API Foundations', lectures: [
          { title: 'What is REST?', durationSec: 360, free: true },
          { title: 'Express basics', durationSec: 720 },
          { title: 'Routing & middleware', durationSec: 840 },
        ] },
        { title: 'Data & Auth', lectures: [
          { title: 'Connecting Postgres', durationSec: 900 },
          { title: 'JWT authentication', durationSec: 1020 },
          { title: 'Validation & errors', durationSec: 600 },
        ] },
      ],
    },
    {
      instructor: 1,
      title: 'Python for Data Science & Machine Learning',
      subtitle: 'From zero to predictive models with pandas, scikit-learn and real datasets',
      category: 'Development',
      subcategory: 'Data Science',
      level: 'beginner',
      priceCents: 1799900,
      featured: true,
      objectives: ['Analyze data with pandas', 'Visualize with matplotlib', 'Build ML models with scikit-learn', 'Evaluate and tune models'],
      requirements: ['No prior experience needed', 'Curiosity about data'],
      audience: ['Aspiring data scientists', 'Analysts', 'Developers'],
      sections: [
        { title: 'Python Crash Course', lectures: [
          { title: 'Why Python for data?', durationSec: 300, free: true },
          { title: 'NumPy essentials', durationSec: 960 },
          { title: 'Pandas DataFrames', durationSec: 1140 },
        ] },
        { title: 'Machine Learning', lectures: [
          { title: 'Supervised learning intro', durationSec: 780 },
          { title: 'Linear regression', durationSec: 1080 },
          { title: 'Classification', durationSec: 1200 },
        ] },
      ],
    },
    {
      instructor: 2,
      title: 'UX Design Fundamentals: From Idea to Prototype',
      subtitle: 'Learn user research, wireframing, and prototyping to design products people love',
      category: 'Design',
      subcategory: 'UX Design',
      level: 'beginner',
      priceCents: 1299900,
      objectives: ['Run user research', 'Create wireframes & prototypes', 'Apply design principles', 'Test with users'],
      requirements: ['No design experience required'],
      audience: ['Aspiring designers', 'Product managers', 'Founders'],
      sections: [
        { title: 'UX Foundations', lectures: [
          { title: 'What is UX?', durationSec: 360, free: true },
          { title: 'The design process', durationSec: 600 },
          { title: 'User research methods', durationSec: 900 },
        ] },
        { title: 'Designing & Testing', lectures: [
          { title: 'Wireframing basics', durationSec: 720 },
          { title: 'Prototyping in Figma', durationSec: 1080 },
          { title: 'Usability testing', durationSec: 660 },
        ] },
      ],
    },
    {
      instructor: 1,
      title: 'Digital Marketing Bootcamp 2026',
      subtitle: 'SEO, social media, email and paid ads — a complete growth marketing system',
      category: 'Marketing',
      subcategory: 'Digital Marketing',
      level: 'all',
      priceCents: 999900,
      objectives: ['Build a marketing funnel', 'Rank with SEO', 'Run paid ad campaigns', 'Grow with email'],
      requirements: ['A willingness to learn'],
      audience: ['Small business owners', 'Marketers', 'Freelancers'],
      sections: [
        { title: 'Strategy', lectures: [
          { title: 'Marketing fundamentals', durationSec: 420, free: true },
          { title: 'Understanding your audience', durationSec: 660 },
        ] },
        { title: 'Channels', lectures: [
          { title: 'SEO essentials', durationSec: 840 },
          { title: 'Paid advertising', durationSec: 960 },
          { title: 'Email marketing', durationSec: 720 },
        ] },
      ],
    },
    {
      instructor: 0,
      title: 'TypeScript: From Beginner to Pro',
      subtitle: 'Master types, generics, and advanced patterns to write safer JavaScript',
      category: 'Development',
      subcategory: 'Programming Languages',
      level: 'intermediate',
      priceCents: 0, // free course
      objectives: ['Understand the type system', 'Use generics confidently', 'Type React and Node apps'],
      requirements: ['JavaScript knowledge'],
      audience: ['JS developers', 'React/Node developers'],
      sections: [
        { title: 'Type Basics', lectures: [
          { title: 'Why TypeScript?', durationSec: 300, free: true },
          { title: 'Primitive types', durationSec: 540, free: true },
          { title: 'Interfaces & types', durationSec: 720 },
        ] },
        { title: 'Advanced Types', lectures: [
          { title: 'Generics', durationSec: 900 },
          { title: 'Utility types', durationSec: 660 },
        ] },
      ],
    },
  ];

  const createdCourses = [];
  for (const def of defs) {
    const instructor = instructors[def.instructor];
    const [course] = await db
      .insert(courses)
      .values({
        instructorId: instructor.id,
        title: def.title,
        subtitle: def.subtitle,
        slug: slugify(def.title),
        description: `<p>${def.subtitle}.</p><p>This comprehensive course takes you step by step through everything you need to know. You'll work on hands-on projects, learn industry best practices, and gain the confidence to apply your new skills immediately. By the end you'll have built real, portfolio-worthy projects.</p><p>Enroll today and start learning at your own pace with lifetime access.</p>`,
        categoryId: catMap.get(def.category)!,
        subcategoryId: catMap.get(def.subcategory) ?? null,
        topics: [def.subcategory],
        level: def.level,
        language: 'English',
        image: img(slugify(def.title)),
        promoVideo: SAMPLE_VIDEOS[0],
        priceCents: def.priceCents,
        currency: 'INR',
        status: 'published',
        publishedAt: new Date(),
        learningObjectives: def.objectives,
        requirements: def.requirements,
        targetAudience: def.audience,
        featured: def.featured ?? false,
      })
      .returning();

    let so = 0;
    let vIdx = 0;
    for (const sdef of def.sections) {
      const [section] = await db
        .insert(sections)
        .values({ courseId: course.id, title: sdef.title, order: so++ })
        .returning();
      let lo = 0;
      for (const ldef of sdef.lectures) {
        const isQuiz = ldef.title.toLowerCase().includes('check') || ldef.title.toLowerCase().includes('knowledge');
        const [lecture] = await db
          .insert(lectures)
          .values({
            sectionId: section.id,
            courseId: course.id,
            title: ldef.title,
            type: isQuiz ? 'quiz' : 'video',
            videoUrl: isQuiz ? null : SAMPLE_VIDEOS[vIdx++ % SAMPLE_VIDEOS.length],
            durationSec: ldef.durationSec,
            isFreePreview: ldef.free ?? false,
            order: lo++,
          })
          .returning();

        if (isQuiz) {
          const [quiz] = await db
            .insert(quizzes)
            .values({ lectureId: lecture.id, title: 'Knowledge Check', passPct: 70 })
            .returning();
          await db.insert(quizQuestions).values([
            {
              quizId: quiz.id,
              type: 'single',
              prompt: 'What does JSX compile to?',
              options: ['HTML strings', 'React.createElement calls', 'CSS', 'JSON'],
              correct: [1],
              explanation: 'JSX is syntactic sugar for React.createElement() calls.',
              order: 0,
            },
            {
              quizId: quiz.id,
              type: 'boolean',
              prompt: 'React components must return a single root element (or fragment).',
              options: ['True', 'False'],
              correct: [0],
              explanation: 'Components return one root node; use fragments to group siblings.',
              order: 1,
            },
          ]);
        }
      }
    }
    createdCourses.push(course);
  }

  console.log('· Enrolling students, adding reviews…');
  // Enroll Alex into the first 3 courses and leave reviews
  const reviewTexts = [
    { rating: 5, body: 'Absolutely fantastic course. Clear explanations and great projects!' },
    { rating: 4, body: 'Really solid content. Could use a few more exercises but I learned a lot.' },
    { rating: 5, body: 'The best course I have taken on this topic. Highly recommended.' },
  ];
  for (let i = 0; i < 3; i++) {
    const course = createdCourses[i];
    const [enr] = await db
      .insert(enrollments)
      .values({ userId: students[0].id, courseId: course.id, source: 'purchase' })
      .returning();
    await db.insert(reviews).values({
      courseId: course.id,
      userId: students[0].id,
      rating: reviewTexts[i].rating,
      body: reviewTexts[i].body,
      helpfulCount: 3 + i,
    });
    // a second reviewer
    await db
      .insert(enrollments)
      .values({ userId: students[1].id, courseId: course.id, source: 'purchase' })
      .onConflictDoNothing();
    await db.insert(reviews).values({
      courseId: course.id,
      userId: students[1].id,
      rating: 5,
      body: 'Worth every penny. The instructor really knows the subject.',
      helpfulCount: 2,
    });
  }

  console.log('· Creating a sample coupon…');
  await db.insert(coupons).values({
    code: 'LAUNCH50',
    scope: 'platform',
    type: 'percent',
    value: 50,
    maxUses: 1000,
    active: true,
  });

  console.log('· Recomputing course aggregates…');
  for (const c of createdCourses) await recomputeCourseAggregates(c.id);

  console.log('\n✓ Seed complete!\n');
  console.log('  Accounts (password for all:  Password123!):');
  console.log('   • admin@e-learning.dev      — admin + instructor + student');
  console.log('   • sarah@e-learning.dev      — instructor (React/Node courses)');
  console.log('   • david@e-learning.dev      — instructor (Data/Marketing)');
  console.log('   • maria@e-learning.dev      — instructor (Design)');
  console.log('   • alex@e-learning.dev       — student (enrolled in 3 courses)');
  console.log('   • priya@e-learning.dev      — student');
  console.log('   • tom@e-learning.dev        — student');
  console.log('\n  Coupon: LAUNCH50  (50% off, platform-wide)\n');
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seed failed:', err);
    pool.end();
    process.exit(1);
  });
