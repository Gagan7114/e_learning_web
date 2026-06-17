import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Award, Receipt, BadgeCheck } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/toast';
import { money, timeAgo } from '@/lib/format';
import { PageLoader, EmptyState, Avatar, Badge } from '@/components/ui';

/* ------------------------- Account settings ------------------------- */

export function AccountPage() {
  const { user, refreshMe, becomeInstructor, has } = useAuth();
  const [form, setForm] = useState({ name: '', headline: '', bio: '', avatar: '' });

  useEffect(() => {
    if (user) setForm({ name: user.name, headline: user.headline ?? '', bio: user.bio ?? '', avatar: user.avatar ?? '' });
  }, [user]);

  const save = useMutation({
    mutationFn: async () => api.put('/me/profile', form),
    onSuccess: async () => {
      await refreshMe();
      toast.success('Profile updated');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (!user) return <PageLoader />;

  return (
    <div className="container-page max-w-3xl py-8">
      <h1 className="mb-6 text-3xl font-bold">Account settings</h1>

      <div className="flex items-center gap-4 rounded-lg border p-5">
        <Avatar name={user.name} src={form.avatar || user.avatar} size={64} />
        <div className="flex-1">
          <p className="font-bold">{user.name}</p>
          <p className="text-sm text-ink-500">{user.email}</p>
          <div className="mt-1 flex gap-1">
            {user.roles.map((r) => (
              <Badge key={r} color="brand">
                {r}
              </Badge>
            ))}
          </div>
        </div>
        {!has('instructor') && (
          <button
            onClick={async () => {
              await becomeInstructor();
              toast.success('You can now create courses!');
            }}
            className="btn-secondary"
          >
            Become an instructor
          </button>
        )}
      </div>

      <div className="mt-6 space-y-4 rounded-lg border p-5">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Headline</label>
          <input
            className="input"
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
            placeholder="e.g. Software engineer & lifelong learner"
          />
        </div>
        <div>
          <label className="label">Bio</label>
          <textarea className="input" rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </div>
        <div>
          <label className="label">Avatar URL</label>
          <input className="input" value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} />
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary">
          Save changes
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link to="/orders" className="flex flex-col items-center gap-1 rounded-lg border p-4 text-sm hover:shadow-card">
          <Receipt className="h-6 w-6 text-brand-600" /> Purchase history
        </Link>
        <Link to="/certificates" className="flex flex-col items-center gap-1 rounded-lg border p-4 text-sm hover:shadow-card">
          <Award className="h-6 w-6 text-brand-600" /> Certificates
        </Link>
        <Link to="/notifications" className="flex flex-col items-center gap-1 rounded-lg border p-4 text-sm hover:shadow-card">
          <Bell className="h-6 w-6 text-brand-600" /> Notifications
        </Link>
        <Link to="/wishlist" className="flex flex-col items-center gap-1 rounded-lg border p-4 text-sm hover:shadow-card">
          <BadgeCheck className="h-6 w-6 text-brand-600" /> Wishlist
        </Link>
      </div>
    </div>
  );
}

/* ------------------------- Notifications ------------------------- */

export function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/me/notifications')).data as { notifications: any[]; unread: number },
  });
  const readAll = useMutation({
    mutationFn: async () => api.post('/me/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-count'] });
    },
  });

  if (isLoading) return <PageLoader />;
  const list = data?.notifications ?? [];

  const label: Record<string, string> = {
    new_enrollment: 'New enrollment in your course',
    new_review: 'You received a new review',
    course_approved: 'Your course was approved 🎉',
    course_rejected: 'Your course needs changes',
    qna_answered: 'Your question was answered',
    certificate_earned: 'You earned a certificate 🏆',
  };

  return (
    <div className="container-page max-w-2xl py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Notifications</h1>
        {list.length > 0 && (
          <button onClick={() => readAll.mutate()} className="btn-secondary">
            Mark all read
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Bell className="h-10 w-10" />} title="No notifications yet" />
      ) : (
        <div className="divide-y rounded-lg border">
          {list.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-4 ${n.read ? '' : 'bg-brand-50'}`}>
              <Bell className="mt-0.5 h-5 w-5 text-brand-600" />
              <div className="flex-1">
                <p className="font-medium">{label[n.type] ?? n.type}</p>
                {n.payload?.courseTitle && <p className="text-sm text-ink-500">{n.payload.courseTitle}</p>}
                {n.payload?.note && <p className="text-sm text-ink-500">Note: {n.payload.note}</p>}
                <p className="text-xs text-ink-500">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.read && <span className="h-2 w-2 rounded-full bg-brand-600" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------- Orders ------------------------- */

export function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await api.get('/orders')).data.orders as any[],
  });
  const qc = useQueryClient();
  const refund = useMutation({
    mutationFn: async (orderId: string) => api.post(`/orders/${orderId}/refund`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Refund processed');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (isLoading) return <PageLoader />;
  const orders = data ?? [];

  return (
    <div className="container-page max-w-3xl py-8">
      <h1 className="mb-6 text-3xl font-bold">Purchase history</h1>
      {orders.length === 0 ? (
        <EmptyState icon={<Receipt className="h-10 w-10" />} title="No orders yet" />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="font-semibold">Order #{String(o.id).slice(0, 8)}</p>
                  <p className="text-xs text-ink-500">{new Date(o.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <Badge color={o.status === 'refunded' ? 'red' : 'green'}>{o.status}</Badge>
                  <p className="mt-1 font-bold">{money(o.totalCents, o.currency)}</p>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {o.items.map((it: any) => (
                  <div key={it.courseId} className="flex items-center justify-between text-sm">
                    <Link to={`/course/${it.slug}`} className="hover:text-brand-700">
                      {it.title}
                    </Link>
                    <span>{money(it.priceCents, o.currency)}</span>
                  </div>
                ))}
              </div>
              {o.status === 'paid' && (
                <button onClick={() => refund.mutate(o.id)} className="mt-2 text-xs text-red-600 hover:underline">
                  Request refund (within 30 days)
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------- Certificates ------------------------- */

export function CertificatesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['certificates'],
    queryFn: async () => (await api.get('/learning/me/certificates')).data.certificates as any[],
  });
  if (isLoading) return <PageLoader />;
  const certs = data ?? [];

  return (
    <div className="container-page max-w-3xl py-8">
      <h1 className="mb-6 text-3xl font-bold">Certificates</h1>
      {certs.length === 0 ? (
        <EmptyState
          icon={<Award className="h-10 w-10" />}
          title="No certificates yet"
          subtitle="Complete a course 100% to earn a certificate."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {certs.map((c) => (
            <div key={c.id} className="rounded-lg border bg-gradient-to-br from-amber-50 to-white p-5">
              <Award className="h-8 w-8 text-amber-500" />
              <p className="mt-2 font-bold">{c.courseTitle}</p>
              <p className="text-sm text-ink-500">Awarded to {c.userName}</p>
              <p className="mt-1 text-xs text-ink-500">
                Serial {c.serial} · {new Date(c.issuedAt).toLocaleDateString()}
              </p>
              <Link to={c.verifyUrl} className="btn-secondary mt-3 text-xs">
                Verify certificate
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
