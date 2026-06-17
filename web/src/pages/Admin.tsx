import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  BookCheck,
  Users,
  FolderTree,
  Search,
  Check,
  X,
  Star,
  DollarSign,
  Plus,
  Trash2,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { toast } from '@/store/toast';
import { money, rating } from '@/lib/format';
import { PageLoader, Badge, EmptyState } from '@/components/ui';
import type { Category } from '@/lib/types';

function AdminShell({ children }: { children: React.ReactNode }) {
  const nav = [
    ['/admin', 'Dashboard', LayoutDashboard],
    ['/admin/courses', 'Courses', BookCheck],
    ['/admin/users', 'Users', Users],
    ['/admin/categories', 'Categories', FolderTree],
  ] as const;
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="hidden w-56 shrink-0 border-r bg-gray-50 p-4 lg:block">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">Admin</h2>
        <nav className="space-y-1">
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-gray-200'
                }`
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 p-6">{children}</div>
    </div>
  );
}

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await api.get('/admin/dashboard')).data,
  });
  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Platform overview</h1>
      {isLoading ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Kpi label="GMV" value={money(data.kpis.gmvCents)} icon={<DollarSign className="h-5 w-5" />} />
            <Kpi label="Users" value={data.kpis.users.toLocaleString()} icon={<Users className="h-5 w-5" />} />
            <Kpi label="Courses" value={data.kpis.courses.toLocaleString()} icon={<BookCheck className="h-5 w-5" />} />
            <Kpi label="Pending review" value={data.kpis.pendingReview.toLocaleString()} icon={<BookCheck className="h-5 w-5" />} highlight={data.kpis.pendingReview > 0} />
            <Kpi label="Refunds" value={data.kpis.refunds.toLocaleString()} icon={<X className="h-5 w-5" />} />
          </div>
          <h2 className="mb-3 mt-8 text-lg font-bold">Top courses</h2>
          <div className="divide-y rounded-lg border">
            {data.topCourses.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 text-sm">
                <Link to={`/course/${c.slug}`} className="font-medium hover:text-brand-700">
                  {c.title}
                </Link>
                <span className="text-ink-500">
                  {c.studentsCount} students · {rating(c.ratingAvg).toFixed(1)}★
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}

function Kpi({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-amber-300 bg-amber-50' : ''}`}>
      <div className="flex items-center justify-between text-ink-500">
        <span className="text-xs">{label}</span>
        {icon}
      </div>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}

export function AdminCoursesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('review');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-courses', status],
    queryFn: async () => (await api.get('/admin/courses', { params: status ? { status } : {} })).data.courses as any[],
  });
  const approve = useMutation({
    mutationFn: async (id: string) => api.post(`/admin/courses/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-courses'] });
      toast.success('Course approved & published');
    },
  });
  const reject = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => api.post(`/admin/courses/${id}/reject`, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-courses'] });
      toast.success('Course rejected');
    },
  });
  const feature = useMutation({
    mutationFn: async ({ id, featured }: { id: string; featured: boolean }) => api.post(`/admin/courses/${id}/feature`, { featured }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-courses'] }),
  });

  const tabs = ['review', 'published', 'draft', 'rejected', ''];
  return (
    <AdminShell>
      <h1 className="mb-4 text-2xl font-bold">Course management</h1>
      <div className="mb-4 flex gap-2">
        {tabs.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${
              status === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-ink-700'
            }`}
          >
            {s || 'all'}
          </button>
        ))}
      </div>
      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Nothing here" subtitle="No courses with this status." />
      ) : (
        <div className="divide-y rounded-lg border">
          {data.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <Link to={`/course/${c.slug}`} className="font-semibold hover:text-brand-700">
                  {c.title}
                </Link>
                <p className="text-xs text-ink-500">
                  by {c.instructorName} · {c.priceCents === 0 ? 'Free' : money(c.priceCents)} ·{' '}
                  <Badge color={c.status === 'published' ? 'green' : c.status === 'review' ? 'amber' : 'gray'}>{c.status}</Badge>
                </p>
              </div>
              {c.status === 'published' && (
                <button
                  onClick={() => feature.mutate({ id: c.id, featured: !c.featured })}
                  className={`badge ${c.featured ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  <Star className="mr-1 h-3 w-3" /> {c.featured ? 'Featured' : 'Feature'}
                </button>
              )}
              {c.status === 'review' && (
                <>
                  <button onClick={() => approve.mutate(c.id)} className="btn-primary py-1">
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      const note = prompt('Reason for rejection:');
                      if (note) reject.mutate({ id: c.id, note });
                    }}
                    className="btn-secondary py-1 text-red-600"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', q],
    queryFn: async () => (await api.get('/admin/users', { params: q ? { q } : {} })).data.users as any[],
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.post(`/admin/users/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User updated');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <AdminShell>
      <h1 className="mb-4 text-2xl font-bold">User management</h1>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="input pl-9" />
      </div>
      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Roles</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-medium">{u.name}</td>
                  <td className="px-4 py-2 text-ink-500">{u.email}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {u.roles.map((r: string) => (
                        <Badge key={r} color="brand">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge color={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    {u.status === 'active' ? (
                      <button onClick={() => setStatus.mutate({ id: u.id, status: 'suspended' })} className="text-xs text-red-600 hover:underline">
                        Suspend
                      </button>
                    ) : (
                      <button onClick={() => setStatus.mutate({ id: u.id, status: 'active' })} className="text-xs text-green-600 hover:underline">
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

export function AdminCategoriesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data.categories as Category[],
  });
  const create = useMutation({
    mutationFn: async () => api.post('/categories', { name, parentId: parentId || null }),
    onSuccess: () => {
      setName('');
      setParentId('');
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category created');
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  return (
    <AdminShell>
      <h1 className="mb-4 text-2xl font-bold">Categories & topics</h1>
      <div className="mb-6 flex flex-wrap items-end gap-2 rounded-lg border p-4">
        <div className="flex-1">
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category or subcategory" />
        </div>
        <div>
          <label className="label">Parent (optional)</label>
          <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Top level —</option>
            {data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button onClick={() => name && create.mutate()} className="btn-primary">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-3">
          {data?.map((c) => (
            <div key={c.id} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{c.icon}</span>
                <span className="font-bold">{c.name}</span>
                <button onClick={() => del.mutate(c.id)} className="ml-auto text-ink-500 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {c.children && c.children.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 pl-8">
                  {c.children.map((s) => (
                    <span key={s.id} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs">
                      {s.name}
                      <button onClick={() => del.mutate(s.id)} className="text-ink-500 hover:text-red-600">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
