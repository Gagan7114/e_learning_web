import { Link } from 'react-router-dom';
import type { CourseCard as Course } from '@/lib/types';
import { money, rating } from '@/lib/format';
import { Stars, Badge } from './ui';

export function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      to={`/course/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-card"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        <img
          src={course.image ?? `https://picsum.photos/seed/${course.slug}/640/360`}
          alt={course.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {course.featured && (
          <span className="absolute left-2 top-2">
            <Badge color="amber">Bestseller</Badge>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="clamp-2 font-bold leading-snug text-ink-900 group-hover:text-brand-700">
          {course.title}
        </h3>
        <p className="mt-0.5 text-xs text-ink-500">{course.instructorName}</p>
        {course.ratingCount > 0 ? (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-sm font-bold text-amber-700">{rating(course.ratingAvg).toFixed(1)}</span>
            <Stars value={course.ratingAvg} />
            <span className="text-xs text-ink-500">({course.ratingCount.toLocaleString()})</span>
          </div>
        ) : (
          <p className="mt-1 text-xs text-ink-500">No ratings yet</p>
        )}
        <div className="mt-auto flex items-center gap-2 pt-2">
          {course.priceCents === 0 ? (
            <span className="text-base font-bold text-green-700">Free</span>
          ) : (
            <span className="text-base font-bold text-ink-900">
              {money(course.priceCents, course.currency)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function CourseRow({ courses }: { courses: Course[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {courses.map((c) => (
        <CourseCard key={c.id} course={c} />
      ))}
    </div>
  );
}
