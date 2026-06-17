import { useState } from 'react';
import { Link, useNavigate, NavLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  BookOpen,
  Wallet,
  Plus,
  Users,
  Star,
  TrendingUp,
  Edit,
  Trash2,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { toast } from '@/store/toast';
import { money, rating, timeAgo } from '@/lib/format';
import { PageLoader, EmptyState, Badge } from '@/components/ui';

function InstructorShell({ children }: { children: React.ReactNode }) {
  const nav = [
    ['/instructor', 'Dashboard', LayoutDashboard],
    ['/instructor/courses', 'My courses', BookOpen],
    ['/instructor/earnings', 'Earnings', Wallet],
  ] as const;
  return (
    <div className="container-page flex gap-8 py-8">
      <aside className="hidden w-52 shrink-0 lg:block">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">Instructor</h2>
        <nav className="space-y-1">
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/instructor'}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-gray-100'
                }`
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">{label}</p>
        <span className="text-brand-600">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

export function InstructorDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['instructor-dashboard'],
    queryFn: async () => (await api.get('/instructor/courses/dashboard')).data,
  });

  return (
    <InstructorShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <CreateCourseButton />
      </div>
      {isLoading ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Total students" value={(data.stats.students ?? 0).toLocaleString()} icon={<Users className="h-5 w-5" />} />
            <Stat label="Net revenue" value={money(data.stats.net ?? 0)} icon={<Wallet className="h-5 w-5" />} />
            <Stat label="Avg rating" value={rating(data.stats.avgRating ?? 0).toFixed(2)} icon={<Star className="h-5 w-5" />} />
            <Stat label="Published" value={`${data.stats.published}/${data.stats.totalCourses}`} icon={<TrendingUp className="h-5 w-5" />} />
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold">Recent reviews</h2>
            {data.recentReviews.length === 0 ? (
              <p className="text-sm text-ink-500">No reviews yet.</p>
            ) : (
              <div className="space-y-2">
                {data.recentReviews.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                    <span className="font-bold text-amber-600">{'★'.repeat(r.rating)}</span>
                    <span className="flex-1">{r.body}</span>
                    <span className="text-xs text-ink-500">{timeAgo(r.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </InstructorShell>
  );
}

function CreateCourseButton() {
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: async () => (await api.post('/instructor/courses', { title: 'Untitled course' })).data.course,
    onSuccess: (course) => navigate(`/instructor/courses/${course.id}/edit`),
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <button onClick={() => create.mutate()} className="btn-primary">
      <Plus className="h-4 w-4" /> New course
    </button>
  );
}

export function InstructorCoursesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['instructor-courses'],
    queryFn: async () => (await api.get('/instructor/courses')).data.courses as any[],
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/instructor/courses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instructor-courses'] });
      toast.success('Course deleted');
    },
  });

  const statusColor: Record<string, any> = {
    draft: 'gray',
    review: 'amber',
    published: 'green',
    unpublished: 'gray',
    rejected: 'red',
  };

  return (
    <InstructorShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">My courses</h1>
        <CreateCourseButton />
      </div>
      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-10 w-10" />} title="No courses yet" subtitle="Create your first course to start teaching." />
      ) : (
        <div className="divide-y rounded-lg border">
          {data.map((c) => (
            <div key={c.id} className="flex items-center gap-4 p-4">
              <img src={c.image ?? `https://picsum.photos/seed/${c.slug}/160/90`} alt="" className="h-14 w-24 rounded object-cover" />
              <div className="flex-1">
                <p className="font-bold">{c.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge color={statusColor[c.status]}>{c.status}</Badge>
                  <span className="text-xs text-ink-500">
                    {c.studentsCount} students · {rating(c.ratingAvg).toFixed(1)}★
                  </span>
                </div>
              </div>
              <p className="font-semibold">{c.priceCents === 0 ? 'Free' : money(c.priceCents, c.currency)}</p>
              <Link to={`/instructor/courses/${c.id}/edit`} className="btn-secondary">
                <Edit className="h-4 w-4" /> Edit
              </Link>
              <button onClick={() => confirm('Delete this course?') && del.mutate(c.id)} className="text-ink-500 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </InstructorShell>
  );
}

export function InstructorEarningsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['instructor-earnings'],
    queryFn: async () => (await api.get('/instructor/courses/earnings')).data,
  });
  return (
    <InstructorShell>
      <h1 className="mb-6 text-3xl font-bold">Earnings & payouts</h1>
      {isLoading ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Net balance" value={money(data.totals.net ?? 0)} icon={<Wallet className="h-5 w-5" />} />
            <Stat label="Gross sales" value={money(data.totals.gross ?? 0)} icon={<TrendingUp className="h-5 w-5" />} />
            <Stat label="Platform fees" value={money(data.totals.fees ?? 0)} icon={<Users className="h-5 w-5" />} />
          </div>
          <div className="mt-6 rounded-lg border p-5">
            <p className="text-sm text-ink-500">
              Payouts are processed monthly to your configured method. The platform takes a configurable
              revenue share per sale (50% default).
            </p>
          </div>
          <h2 className="mb-3 mt-8 text-lg font-bold">Transactions</h2>
          {data.transactions.length === 0 ? (
            <p className="text-sm text-ink-500">No transactions yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-ink-500">
                  <tr>
                    <th className="px-4 py-2">Course</th>
                    <th className="px-4 py-2">Gross</th>
                    <th className="px-4 py-2">Fee</th>
                    <th className="px-4 py-2">Net</th>
                    <th className="px-4 py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.transactions.map((t: any) => (
                    <tr key={t.id}>
                      <td className="px-4 py-2">{t.courseTitle}</td>
                      <td className="px-4 py-2">{money(t.grossCents)}</td>
                      <td className="px-4 py-2 text-red-600">-{money(t.feeCents)}</td>
                      <td className="px-4 py-2 font-semibold text-green-700">{money(t.netCents)}</td>
                      <td className="px-4 py-2 text-ink-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </InstructorShell>
  );
}
