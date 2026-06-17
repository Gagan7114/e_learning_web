import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, CheckCircle2, XCircle, DollarSign, Globe, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/toast';
import { CourseCard } from '@/components/CourseCard';
import { PageLoader, Avatar, EmptyState, Stars } from '@/components/ui';
import { rating } from '@/lib/format';
import type { CourseCard as Course } from '@/lib/types';

/* ----------------------- Become an instructor ----------------------- */

export function TeachPage() {
  const { user, has, becomeInstructor } = useAuth();
  const navigate = useNavigate();

  async function start() {
    if (!user) return navigate('/register');
    if (has('instructor')) return navigate('/instructor');
    await becomeInstructor();
    toast.success('Welcome, instructor!');
    navigate('/instructor');
  }

  return (
    <div>
      <section className="bg-ink-900 text-white">
        <div className="container-page grid items-center gap-8 py-20 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-extrabold sm:text-5xl">Come teach with us</h1>
            <p className="mt-4 max-w-md text-lg text-gray-300">
              Become an instructor and change lives — including your own. Create a course, build your
              audience, and earn revenue with every sale.
            </p>
            <button onClick={start} className="btn-primary mt-8 px-8 py-3 text-base">
              {has('instructor') ? 'Go to instructor dashboard' : 'Start teaching today'}
            </button>
          </div>
          <img
            src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=700&q=80"
            alt="Teaching"
            className="hidden rounded-xl shadow-2xl lg:block"
          />
        </div>
      </section>
      <div className="container-page grid gap-8 py-16 md:grid-cols-3">
        <Perk icon={<DollarSign className="h-8 w-8" />} title="Earn money" desc="Get paid for every enrollment with transparent revenue sharing." />
        <Perk icon={<Globe className="h-8 w-8" />} title="Reach the world" desc="Teach students across the globe, on their schedule." />
        <Perk icon={<Users className="h-8 w-8" />} title="Inspire learners" desc="Share your expertise and build a community." />
      </div>
      <div className="container-page pb-16 text-center">
        <h2 className="text-2xl font-bold">How to begin</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {['Plan your course', 'Record & upload', 'Launch & earn'].map((step, i) => (
            <div key={step} className="rounded-lg border p-6">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-bold text-white">
                {i + 1}
              </div>
              <p className="font-semibold">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Perk({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        {icon}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-ink-500">{desc}</p>
    </div>
  );
}

/* ----------------------- Public instructor profile ----------------------- */

export function InstructorPublicPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['instructor-public', id],
    queryFn: async () => (await api.get(`/instructors/${id}`)).data,
  });
  if (isLoading) return <PageLoader />;
  if (!data) return <div className="container-page py-12">Instructor not found.</div>;

  const { instructor, courses } = data;
  return (
    <div className="container-page py-10">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <Avatar name={instructor.name} src={instructor.avatar} size={120} />
        <div>
          <h1 className="text-3xl font-bold">{instructor.name}</h1>
          <p className="text-ink-500">{instructor.headline}</p>
          <div className="mt-3 flex gap-6 text-sm">
            <span>
              <strong>{(instructor.stats?.students ?? 0).toLocaleString()}</strong> students
            </span>
            <span>
              <strong>{(instructor.stats?.reviews ?? 0).toLocaleString()}</strong> reviews
            </span>
            <span className="flex items-center gap-1">
              <strong>{rating(instructor.stats?.rating ?? 0).toFixed(1)}</strong>
              <Stars value={instructor.stats?.rating ?? 0} />
            </span>
          </div>
          {instructor.bio && <p className="mt-3 max-w-2xl text-sm text-ink-700">{instructor.bio}</p>}
        </div>
      </div>

      <h2 className="mb-4 mt-10 text-2xl font-bold">Courses by {instructor.name}</h2>
      {courses.length === 0 ? (
        <EmptyState title="No published courses yet" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {courses.map((c: Course) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------- Certificate verification ----------------------- */

export function VerifyCertificatePage() {
  const { serial } = useParams<{ serial: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['verify', serial],
    queryFn: async () => (await api.get(`/verify/${serial}`)).data,
    retry: false,
  });
  if (isLoading) return <PageLoader />;

  return (
    <div className="container-page max-w-lg py-16">
      {error || !data?.valid ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-2 text-xl font-bold">Certificate not found</h1>
          <p className="text-sm text-ink-500">This serial number could not be verified.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-gradient-to-br from-amber-50 to-white p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h1 className="mt-2 text-2xl font-bold">Verified certificate</h1>
          <p className="mt-4 text-lg font-semibold">{data.certificate.userName}</p>
          <p className="text-ink-500">successfully completed</p>
          <p className="mt-1 text-lg font-bold text-brand-700">{data.certificate.courseTitle}</p>
          <p className="mt-4 text-xs text-ink-500">
            Serial {data.certificate.serial} · Issued {new Date(data.certificate.issuedAt).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}

/* ----------------------- Static / CMS pages ----------------------- */

const staticContent: Record<string, { title: string; body: string }> = {
  about: { title: 'About e-learning', body: 'e-learning is a two-sided marketplace where instructors publish video courses and students discover, purchase, and learn from them. This site is a Phase-1 MVP built with Node.js, React, Drizzle and PostgreSQL.' },
  terms: { title: 'Terms of Service', body: 'These are placeholder terms of service for the e-learning MVP. By using the platform you agree to learn, teach, and be excellent to each other.' },
  privacy: { title: 'Privacy Policy', body: 'We respect your privacy. This MVP stores only the data needed to operate the marketplace. Passwords are hashed; payment data is delegated to payment providers.' },
  'refund-policy': { title: 'Refund Policy', body: 'Most courses are eligible for a 30-day money-back guarantee. Request a refund from your purchase history within 30 days of purchase.' },
  cookies: { title: 'Cookie Policy', body: 'We use a secure httpOnly cookie to keep you signed in. No third-party tracking cookies are used in this MVP.' },
  help: { title: 'Help & Support', body: 'Need help? This is a demo environment. Use the seeded demo accounts to explore student, instructor, and admin experiences.' },
  careers: { title: 'Careers', body: 'We are not actively hiring in this demo — but we love builders. Keep learning!' },
  blog: { title: 'Blog', body: 'Articles and learning tips will appear here.' },
};

export function StaticPage({ slug }: { slug: string }) {
  const content = staticContent[slug] ?? { title: 'Page', body: 'Content coming soon.' };
  return (
    <div className="container-page max-w-2xl py-16">
      <h1 className="text-3xl font-bold">{content.title}</h1>
      <p className="mt-4 leading-relaxed text-ink-700">{content.body}</p>
    </div>
  );
}

/* ----------------------- 404 ----------------------- */

export function NotFoundPage() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <GraduationCap className="h-16 w-16 text-brand-200" />
      <h1 className="mt-4 text-5xl font-extrabold">404</h1>
      <p className="mt-2 text-ink-500">We couldn't find that page.</p>
      <Link to="/" className="btn-primary mt-6">
        Back to home
      </Link>
    </div>
  );
}
