import { useState, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { CourseCard } from '@/components/CourseCard';
import { SkeletonCard, EmptyState, Stars } from '@/components/ui';
import type { CourseCard as Course, Category, Paginated } from '@/lib/types';

interface Filters {
  level?: string;
  price?: string;
  rating?: number;
  language?: string;
  sort: string;
}

function CourseListing({
  base,
  heading,
  subheading,
}: {
  base: Record<string, string | number>;
  heading: string;
  subheading?: string;
}) {
  const [filters, setFilters] = useState<Filters>({ sort: 'relevant' });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string | number> = { ...base, page, limit: 12, sort: filters.sort };
    if (filters.level) p.level = filters.level;
    if (filters.price) p.price = filters.price;
    if (filters.rating) p.rating = filters.rating;
    if (filters.language) p.language = filters.language;
    return p;
  }, [base, filters, page]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['catalog', params],
    queryFn: async () => (await api.get('/courses', { params })).data as Paginated<Course>,
    placeholderData: keepPreviousData,
  });

  const { data: facets } = useQuery({
    queryKey: ['facets'],
    queryFn: async () => (await api.get('/courses/facets')).data as { languages: string[]; levels: string[] },
  });

  function update(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{heading}</h1>
        {subheading && <p className="mt-1 text-ink-500">{subheading}</p>}
      </div>

      <div className="flex items-center justify-between gap-4">
        <button onClick={() => setShowFilters((s) => !s)} className="btn-secondary lg:hidden">
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
        <p className="text-sm text-ink-500">
          {data ? `${data.total.toLocaleString()} results` : ' '}
        </p>
        <select
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value })}
          className="input w-auto"
        >
          <option value="relevant">Most relevant</option>
          <option value="rating">Highest rated</option>
          <option value="newest">Newest</option>
          <option value="enrolled">Most enrolled</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>

      <div className="mt-6 flex gap-8">
        {/* filters sidebar */}
        <aside className={`${showFilters ? 'block' : 'hidden'} w-60 shrink-0 lg:block`}>
          <FilterGroup title="Price">
            {['free', 'paid'].map((p) => (
              <Radio
                key={p}
                name="price"
                checked={filters.price === p}
                onChange={() => update({ price: filters.price === p ? undefined : p })}
                label={p === 'free' ? 'Free' : 'Paid'}
              />
            ))}
          </FilterGroup>
          <FilterGroup title="Rating">
            {[4, 3].map((r) => (
              <button
                key={r}
                onClick={() => update({ rating: filters.rating === r ? undefined : r })}
                className={`flex items-center gap-2 rounded px-1 py-1 text-sm ${
                  filters.rating === r ? 'font-semibold text-brand-700' : ''
                }`}
              >
                <Stars value={r * 100} /> {r}.0 & up
              </button>
            ))}
          </FilterGroup>
          <FilterGroup title="Level">
            {(facets?.levels ?? ['beginner', 'intermediate', 'advanced']).map((l) => (
              <Radio
                key={l}
                name="level"
                checked={filters.level === l}
                onChange={() => update({ level: filters.level === l ? undefined : l })}
                label={l[0].toUpperCase() + l.slice(1)}
              />
            ))}
          </FilterGroup>
          {!!facets?.languages?.length && (
            <FilterGroup title="Language">
              {facets.languages.map((l) => (
                <Radio
                  key={l}
                  name="language"
                  checked={filters.language === l}
                  onChange={() => update({ language: filters.language === l ? undefined : l })}
                  label={l}
                />
              ))}
            </FilterGroup>
          )}
        </aside>

        {/* grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <div
                className={`grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 ${
                  isFetching ? 'opacity-60' : ''
                }`}
              >
                {data.items.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
              {data.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="btn-secondary disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-ink-500">
                    Page {data.page} of {data.totalPages}
                  </span>
                  <button
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-secondary disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="No courses found"
              subtitle="Try adjusting your filters or search terms."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b py-4">
      <h3 className="mb-2 font-bold text-ink-900">{title}</h3>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Radio({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="accent-brand-600" />
      {label}
    </label>
  );
}

export function BrowsePage() {
  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data.categories as Category[],
  });
  return (
    <div>
      <div className="border-b bg-gray-50">
        <div className="container-page py-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {cats?.map((c) => (
              <Link
                key={c.id}
                to={`/category/${c.slug}`}
                className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm hover:border-brand-500 hover:text-brand-700"
              >
                {c.icon} {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <CourseListing base={{}} heading="All courses" subheading="Explore the full catalog" />
    </div>
  );
}

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: cat } = useQuery({
    queryKey: ['category', slug],
    queryFn: async () => (await api.get(`/categories/${slug}`)).data.category as Category,
    enabled: !!slug,
  });
  return (
    <div>
      {cat?.children && cat.children.length > 0 && (
        <div className="border-b bg-gray-50">
          <div className="container-page flex flex-wrap gap-2 py-4">
            {cat.children.map((sub) => (
              <Link
                key={sub.id}
                to={`/search?subcategory=${sub.slug}`}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm hover:border-brand-500"
              >
                {sub.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      <CourseListing
        base={{ category: slug! }}
        heading={cat ? `${cat.icon ?? ''} ${cat.name}` : 'Category'}
        subheading={cat?.description ?? undefined}
      />
    </div>
  );
}

export function SearchPage() {
  const [sp] = useSearchParams();
  const q = sp.get('q') ?? '';
  const subcategory = sp.get('subcategory') ?? '';
  const base: Record<string, string> = {};
  if (q) base.q = q;
  if (subcategory) base.subcategory = subcategory;
  return (
    <CourseListing
      base={base}
      heading={q ? `Results for “${q}”` : subcategory ? 'Browse topic' : 'Search'}
    />
  );
}
