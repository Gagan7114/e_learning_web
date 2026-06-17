import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, PlayCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { PageLoader, ProgressBar, EmptyState } from '@/components/ui';

interface EnrolledCourse {
  id: string;
  title: string;
  slug: string;
  image?: string | null;
  instructorName?: string;
  progressPct: number;
  completedAt?: string | null;
}

export function MyLearningPage() {
  const [filter, setFilter] = useState<'all' | 'in-progress' | 'completed'>('all');
  const { data, isLoading } = useQuery({
    queryKey: ['my-courses'],
    queryFn: async () => (await api.get('/learning/my-courses')).data.courses as EnrolledCourse[],
  });

  if (isLoading) return <PageLoader />;

  const courses = (data ?? []).filter((c) => {
    if (filter === 'in-progress') return c.progressPct > 0 && c.progressPct < 100;
    if (filter === 'completed') return c.progressPct >= 100;
    return true;
  });

  return (
    <div>
      <div className="bg-ink-900 text-white">
        <div className="container-page py-8">
          <h1 className="text-3xl font-bold">My learning</h1>
        </div>
      </div>
      <div className="container-page py-8">
        <div className="mb-6 flex gap-2 border-b">
          {(['all', 'in-progress', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold capitalize ${
                filter === f ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500'
              }`}
            >
              {f.replace('-', ' ')}
            </button>
          ))}
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-10 w-10" />}
            title="Nothing here yet"
            subtitle="Courses you enroll in will show up here."
            action={
              <Link to="/browse" className="btn-primary">
                Browse courses
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map((c) => (
              <Link
                key={c.id}
                to={`/learn/${c.slug}`}
                className="group overflow-hidden rounded-lg border bg-white transition-shadow hover:shadow-card"
              >
                <div className="relative aspect-video bg-gray-100">
                  <img src={c.image ?? ''} alt={c.title} className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <PlayCircle className="h-12 w-12 text-white" />
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="clamp-2 font-bold leading-snug">{c.title}</h3>
                  <p className="text-xs text-ink-500">{c.instructorName}</p>
                  <div className="mt-3">
                    <ProgressBar value={c.progressPct} />
                    <p className="mt-1 text-xs text-ink-500">
                      {c.progressPct >= 100 ? '✓ Completed' : `${c.progressPct}% complete`}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
