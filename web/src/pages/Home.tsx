import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search, Award, Infinity as InfinityIcon, Smartphone, BadgeCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { CourseCard } from '@/components/CourseCard';
import { SkeletonCard } from '@/components/ui';
import type { CourseCard as Course, Category } from '@/lib/types';

function useCourses(params: Record<string, string | number | boolean>) {
  const key = JSON.stringify(params);
  return useQuery({
    queryKey: ['courses', key],
    queryFn: async () => {
      const { data } = await api.get('/courses', { params });
      return data.items as Course[];
    },
  });
}

export function HomePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const featured = useCourses({ featured: true, limit: 5 });
  const trending = useCourses({ sort: 'enrolled', limit: 10 });
  const newest = useCourses({ sort: 'newest', limit: 5 });
  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data.categories as Category[],
  });

  return (
    <div>
      {/* hero */}
      <section className="bg-gradient-to-br from-brand-700 to-brand-900 text-white">
        <div className="container-page grid items-center gap-8 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
              Learn anything,<br />teach everything.
            </h1>
            <p className="mt-4 max-w-md text-lg text-brand-100">
              Thousands of courses from expert instructors. Build real skills at your own pace, with
              lifetime access and a certificate on completion.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/search?q=${encodeURIComponent(q)}`);
              }}
              className="mt-8 flex max-w-md overflow-hidden rounded-full bg-white p-1.5 shadow-lg"
            >
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="What do you want to learn?"
                  className="w-full bg-transparent py-2.5 pl-12 pr-2 text-ink-900 outline-none"
                />
              </div>
              <button className="btn-primary rounded-full px-6">Search</button>
            </form>
          </div>
          <div className="hidden lg:block">
            <img
              src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80"
              alt="People learning"
              className="rounded-xl shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* value props */}
      <section className="border-b bg-white">
        <div className="container-page grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
          <Value icon={<InfinityIcon className="h-6 w-6" />} title="Lifetime access" desc="Learn at your own pace, forever." />
          <Value icon={<Award className="h-6 w-6" />} title="Certificates" desc="Earn one on completion." />
          <Value icon={<Smartphone className="h-6 w-6" />} title="Learn anywhere" desc="On desktop and mobile." />
          <Value icon={<BadgeCheck className="h-6 w-6" />} title="Expert instructors" desc="Vetted and approved." />
        </div>
      </section>

      <div className="container-page space-y-12 py-12">
        {/* categories */}
        <section>
          <h2 className="mb-4 text-2xl font-bold">Top categories</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {cats?.map((c) => (
              <Link
                key={c.id}
                to={`/category/${c.slug}`}
                className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white p-6 text-center transition-shadow hover:shadow-card"
              >
                <span className="text-3xl">{c.icon}</span>
                <span className="font-semibold text-ink-900">{c.name}</span>
                <span className="text-xs text-ink-500">{c.children?.length ?? 0} topics</span>
              </Link>
            ))}
          </div>
        </section>

        <Shelf title="Featured & bestsellers" loading={featured.isLoading} courses={featured.data} />
        <Shelf title="Trending now" loading={trending.isLoading} courses={trending.data} />
        <Shelf title="New & noteworthy" loading={newest.isLoading} courses={newest.data} />

        {/* become instructor CTA */}
        <section className="overflow-hidden rounded-2xl bg-ink-900 text-white">
          <div className="grid items-center gap-6 p-10 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold">Become an instructor</h2>
              <p className="mt-3 text-gray-300">
                Teach what you love. Create a course, reach students around the world, and earn money
                doing what you do best.
              </p>
              <Link to="/teach" className="btn-primary mt-6">
                Start teaching today
              </Link>
            </div>
            <img
              src="https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=600&q=80"
              alt="Instructor"
              className="hidden rounded-xl md:block"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Value({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-brand-600">{icon}</div>
      <div>
        <p className="font-semibold text-ink-900">{title}</p>
        <p className="text-sm text-ink-500">{desc}</p>
      </div>
    </div>
  );
}

function Shelf({ title, courses, loading }: { title: string; courses?: Course[]; loading: boolean }) {
  if (!loading && (!courses || courses.length === 0)) return null;
  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : courses!.map((c) => <CourseCard key={c.id} course={c} />)}
      </div>
    </section>
  );
}
