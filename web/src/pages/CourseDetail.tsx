import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  PlayCircle,
  ChevronDown,
  Globe,
  BarChart,
  Clock,
  FileText,
  Award,
  Smartphone,
  Heart,
  X,
  Lock,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/toast';
import { money, rating, duration, clock } from '@/lib/format';
import { Stars, RatingInline, PageLoader, Avatar, Badge } from '@/components/ui';
import { CourseCard } from '@/components/CourseCard';
import type { CourseDetail, CourseCard as Course, Lecture } from '@/lib/types';

export function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ 0: true });
  const [preview, setPreview] = useState<Lecture | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['course', slug],
    queryFn: async () => (await api.get(`/courses/${slug}`)).data.course as CourseDetail,
    enabled: !!slug,
  });

  const { data: reviews } = useQuery({
    queryKey: ['course-reviews', slug],
    queryFn: async () => (await api.get(`/courses/${slug}/reviews`)).data.reviews as any[],
    enabled: !!slug,
  });

  const { data: related } = useQuery({
    queryKey: ['course-related', slug],
    queryFn: async () => (await api.get(`/courses/${slug}/related`)).data.items as Course[],
    enabled: !!slug,
  });

  const addToCart = useMutation({
    mutationFn: async () => api.post('/cart', { courseId: data!.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart-count'] });
      toast.success('Added to cart');
      navigate('/cart');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const addToWishlist = useMutation({
    mutationFn: async () => api.post('/cart/wishlist', { courseId: data!.id }),
    onSuccess: () => toast.success('Saved to wishlist'),
    onError: (e) => toast.error(apiError(e)),
  });

  const buyNow = useMutation({
    mutationFn: async () => api.post('/orders/checkout', { courseIds: [data!.id] }),
    onSuccess: (res) => {
      qc.invalidateQueries();
      toast.success('Enrolled! Happy learning');
      navigate(`/learn/${res.data.courseSlugs[0]}`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const enrollFree = useMutation({
    mutationFn: async () => api.post('/orders/checkout', { courseIds: [data!.id] }),
    onSuccess: (res) => {
      qc.invalidateQueries();
      toast.success('Enrolled!');
      navigate(`/learn/${res.data.courseSlugs[0]}`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (isLoading) return <PageLoader />;
  if (error || !data)
    return <div className="container-page py-24 text-center text-ink-500">Course not found.</div>;

  const isFree = data.priceCents === 0;
  const totalLectures = data.lectureCount;

  function requireAuthThen(fn: () => void) {
    if (!user) {
      navigate('/login', { state: { from: `/course/${slug}` } });
      return;
    }
    fn();
  }

  return (
    <div>
      {/* dark hero */}
      <div className="bg-ink-900 text-white">
        <div className="container-page grid gap-8 py-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {data.category && (
              <Link to={`/category/${data.category.slug}`} className="text-sm text-brand-300 hover:underline">
                {data.category.name}
              </Link>
            )}
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{data.title}</h1>
            <p className="mt-3 text-lg text-gray-300">{data.subtitle}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {data.ratingCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="font-bold text-amber-400">{rating(data.ratingAvg).toFixed(1)}</span>
                  <Stars value={data.ratingAvg} />
                  <span className="text-gray-300">({data.ratingCount.toLocaleString()} ratings)</span>
                </span>
              )}
              <span className="text-gray-300">{data.studentsCount.toLocaleString()} students</span>
            </div>
            {data.instructor && (
              <p className="mt-2 text-sm text-gray-300">
                Created by{' '}
                <Link to={`/instructor-profile/${data.instructor.id}`} className="text-brand-300 underline">
                  {data.instructor.name}
                </Link>
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Globe className="h-4 w-4" /> {data.language}
              </span>
              <span className="flex items-center gap-1">
                <BarChart className="h-4 w-4" /> {data.level}
              </span>
              {data.updatedAt && (
                <span>Last updated {new Date(data.updatedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-8 py-8 lg:grid-cols-3">
        {/* main column */}
        <div className="space-y-8 lg:col-span-2">
          {/* what you'll learn */}
          {data.learningObjectives && data.learningObjectives.length > 0 && (
            <section className="card p-6">
              <h2 className="mb-4 text-2xl font-bold">What you'll learn</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.learningObjectives.map((o, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* curriculum */}
          <section>
            <h2 className="mb-1 text-2xl font-bold">Course content</h2>
            <p className="mb-4 text-sm text-ink-500">
              {data.sectionCount} sections · {totalLectures} lectures · {duration(data.durationTotalSec ?? 0)} total
            </p>
            <div className="overflow-hidden rounded-lg border">
              {data.curriculum.map((section, idx) => {
                const open = openSections[idx];
                return (
                  <div key={section.id} className="border-b last:border-b-0">
                    <button
                      onClick={() => setOpenSections((s) => ({ ...s, [idx]: !s[idx] }))}
                      className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left hover:bg-gray-100"
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
                        {section.title}
                      </span>
                      <span className="text-xs text-ink-500">{section.lectures.length} lectures</span>
                    </button>
                    {open && (
                      <ul className="divide-y">
                        {section.lectures.map((lec) => (
                          <li key={lec.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                            <span className="flex items-center gap-2">
                              {lec.type === 'quiz' ? (
                                <FileText className="h-4 w-4 text-ink-500" />
                              ) : (
                                <PlayCircle className="h-4 w-4 text-ink-500" />
                              )}
                              <span>{lec.title}</span>
                              {lec.isFreePreview && (
                                <button
                                  onClick={() => setPreview(lec)}
                                  className="text-xs font-semibold text-brand-600 underline"
                                >
                                  Preview
                                </button>
                              )}
                              {lec.locked && !lec.isFreePreview && <Lock className="h-3 w-3 text-ink-500" />}
                            </span>
                            {lec.durationSec > 0 && (
                              <span className="text-xs text-ink-500">{clock(lec.durationSec)}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* requirements */}
          {data.requirements && data.requirements.length > 0 && (
            <section>
              <h2 className="mb-3 text-2xl font-bold">Requirements</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
                {data.requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          {/* description */}
          {data.description && (
            <section>
              <h2 className="mb-3 text-2xl font-bold">Description</h2>
              <div
                className="prose prose-sm max-w-none text-ink-700 [&_p]:mb-3"
                dangerouslySetInnerHTML={{ __html: data.description }}
              />
            </section>
          )}

          {/* who this is for */}
          {data.targetAudience && data.targetAudience.length > 0 && (
            <section>
              <h2 className="mb-3 text-2xl font-bold">Who this course is for</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
                {data.targetAudience.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </section>
          )}

          {/* instructor */}
          {data.instructor && (
            <section>
              <h2 className="mb-3 text-2xl font-bold">Instructor</h2>
              <div className="flex items-start gap-4">
                <Avatar name={data.instructor.name} src={data.instructor.avatar} size={72} />
                <div>
                  <Link
                    to={`/instructor-profile/${data.instructor.id}`}
                    className="text-lg font-bold text-brand-700 hover:underline"
                  >
                    {data.instructor.name}
                  </Link>
                  <p className="text-sm text-ink-500">{data.instructor.headline}</p>
                  {data.instructor.bio && <p className="mt-2 text-sm text-ink-700">{data.instructor.bio}</p>}
                </div>
              </div>
            </section>
          )}

          {/* reviews */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
              <Award className="h-6 w-6 text-amber-500" />
              {rating(data.ratingAvg).toFixed(1)} course rating · {data.ratingCount.toLocaleString()} ratings
            </h2>
            {/* breakdown bars */}
            <div className="mb-6 max-w-md space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = data.ratingBreakdown[star] ?? 0;
                const pct = data.ratingCount ? (count / data.ratingCount) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-3">{star}</span>
                    <Stars value={star * 100} size={12} />
                    <div className="h-2 flex-1 overflow-hidden rounded bg-gray-200">
                      <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-ink-500">{Math.round(pct)}%</span>
                  </div>
                );
              })}
            </div>
            <div className="space-y-5">
              {reviews?.map((r) => (
                <div key={r.id} className="border-b pb-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.userName} src={r.userAvatar} size={40} />
                    <div>
                      <p className="font-semibold">{r.userName}</p>
                      <Stars value={r.rating * 100} />
                    </div>
                  </div>
                  {r.body && <p className="mt-2 text-sm text-ink-700">{r.body}</p>}
                  {r.instructorResponse && (
                    <div className="mt-2 rounded bg-gray-50 p-3 text-sm">
                      <span className="font-semibold">Instructor response:</span> {r.instructorResponse}
                    </div>
                  )}
                </div>
              ))}
              {(!reviews || reviews.length === 0) && (
                <p className="text-sm text-ink-500">No reviews yet. Be the first to review!</p>
              )}
            </div>
          </section>
        </div>

        {/* sticky purchase card */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <div className="overflow-hidden rounded-lg border shadow-card">
              <button
                onClick={() => {
                  const firstPreview = data.curriculum.flatMap((s) => s.lectures).find((l) => l.isFreePreview);
                  if (firstPreview) setPreview(firstPreview);
                }}
                className="group relative block aspect-video w-full bg-gray-900"
              >
                <img src={data.image ?? ''} alt={data.title} className="h-full w-full object-cover opacity-80" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <PlayCircle className="h-16 w-16 text-white drop-shadow-lg transition-transform group-hover:scale-110" />
                </span>
                <span className="absolute bottom-2 left-0 right-0 text-center text-sm font-semibold text-white drop-shadow">
                  Preview this course
                </span>
              </button>

              <div className="p-5">
                {data.enrolled ? (
                  <Link to={`/learn/${data.slug}`} className="btn-primary w-full">
                    Go to course
                  </Link>
                ) : (
                  <>
                    <div className="mb-4 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold">
                        {isFree ? 'Free' : money(data.priceCents, data.currency)}
                      </span>
                    </div>
                    {isFree ? (
                      <button
                        onClick={() => requireAuthThen(() => enrollFree.mutate())}
                        disabled={enrollFree.isPending}
                        className="btn-primary w-full"
                      >
                        Enroll now — free
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <button
                          onClick={() => requireAuthThen(() => addToCart.mutate())}
                          disabled={addToCart.isPending}
                          className="btn-primary w-full"
                        >
                          Add to cart
                        </button>
                        <button
                          onClick={() => requireAuthThen(() => buyNow.mutate())}
                          disabled={buyNow.isPending}
                          className="btn-secondary w-full"
                        >
                          Buy now
                        </button>
                        <button
                          onClick={() => requireAuthThen(() => addToWishlist.mutate())}
                          className="btn-ghost w-full"
                        >
                          <Heart className="h-4 w-4" /> Wishlist
                        </button>
                      </div>
                    )}
                    <p className="mt-3 text-center text-xs text-ink-500">30-Day Money-Back Guarantee</p>
                  </>
                )}

                <div className="mt-5">
                  <p className="mb-2 font-bold">This course includes:</p>
                  <ul className="space-y-2 text-sm text-ink-700">
                    <li className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-ink-500" /> {duration(data.durationTotalSec ?? 0)} on-demand video
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-ink-500" /> {totalLectures} lectures
                    </li>
                    <li className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-ink-500" /> Access on mobile
                    </li>
                    <li className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-ink-500" /> Certificate of completion
                    </li>
                    <li className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-ink-500" /> Full lifetime access
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* related */}
      {related && related.length > 0 && (
        <div className="container-page pb-12">
          <h2 className="mb-4 text-2xl font-bold">Students also bought</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {related.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </div>
      )}

      {/* preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between text-white">
              <p className="font-semibold">{preview.title}</p>
              <button onClick={() => setPreview(null)}>
                <X className="h-6 w-6" />
              </button>
            </div>
            {preview.videoUrl ? (
              <video src={preview.videoUrl} controls autoPlay className="w-full rounded-lg bg-black" />
            ) : (
              <div className="rounded-lg bg-white p-8 text-center">Preview not available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
