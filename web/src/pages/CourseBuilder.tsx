import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, Trash2, GripVertical, Save, Send, Eye } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { toast } from '@/store/toast';
import { PageLoader, Badge } from '@/components/ui';
import type { Category } from '@/lib/types';

type Tab = 'landing' | 'curriculum' | 'pricing' | 'publish';

export function CourseBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('landing');

  const { data, isLoading } = useQuery({
    queryKey: ['builder', id],
    queryFn: async () => (await api.get(`/instructor/courses/${id}`)).data.course,
  });

  if (isLoading || !data) return <PageLoader />;

  return (
    <div>
      <div className="border-b bg-white">
        <div className="container-page flex items-center gap-3 py-3">
          <Link to="/instructor/courses" className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="truncate font-bold">{data.title}</h1>
          <Badge color={data.status === 'published' ? 'green' : data.status === 'review' ? 'amber' : data.status === 'rejected' ? 'red' : 'gray'}>
            {data.status}
          </Badge>
          <div className="ml-auto">
            <Link to={`/course/${data.slug}`} className="btn-secondary">
              <Eye className="h-4 w-4" /> Preview
            </Link>
          </div>
        </div>
        <div className="container-page flex gap-4">
          {(['landing', 'curriculum', 'pricing', 'publish'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-1 py-2 text-sm font-semibold capitalize ${
                tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="container-page max-w-4xl py-8">
        {data.status === 'rejected' && data.rejectionNote && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
            <p className="font-semibold text-red-700">Changes requested by admin:</p>
            <p className="text-red-700">{data.rejectionNote}</p>
          </div>
        )}
        {tab === 'landing' && <LandingEditor course={data} />}
        {tab === 'curriculum' && <CurriculumEditor course={data} />}
        {tab === 'pricing' && <PricingEditor course={data} />}
        {tab === 'publish' && <PublishPanel course={data} onChange={() => qc.invalidateQueries({ queryKey: ['builder', id] })} />}
      </div>
    </div>
  );
}

function useSave(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) =>
      (await api.put(`/instructor/courses/${courseId}`, patch)).data.course,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['builder', courseId] });
      toast.success('Saved');
    },
    onError: (e) => toast.error(apiError(e)),
  });
}

/* --------------------------- Landing --------------------------- */

function LandingEditor({ course }: { course: any }) {
  const save = useSave(course.id);
  const [f, setF] = useState({
    title: course.title,
    subtitle: course.subtitle ?? '',
    description: course.description ?? '',
    categoryId: course.categoryId ?? '',
    subcategoryId: course.subcategoryId ?? '',
    level: course.level,
    language: course.language,
    image: course.image ?? '',
    promoVideo: course.promoVideo ?? '',
    learningObjectives: (course.learningObjectives ?? []).join('\n'),
    requirements: (course.requirements ?? []).join('\n'),
    targetAudience: (course.targetAudience ?? []).join('\n'),
  });

  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data.categories as Category[],
  });
  const parent = cats?.find((c) => c.id === f.categoryId);

  function submit() {
    save.mutate({
      title: f.title,
      subtitle: f.subtitle,
      description: f.description,
      categoryId: f.categoryId || null,
      subcategoryId: f.subcategoryId || null,
      level: f.level,
      language: f.language,
      image: f.image,
      promoVideo: f.promoVideo,
      learningObjectives: f.learningObjectives.split('\n').map((s: string) => s.trim()).filter(Boolean),
      requirements: f.requirements.split('\n').map((s: string) => s.trim()).filter(Boolean),
      targetAudience: f.targetAudience.split('\n').map((s: string) => s.trim()).filter(Boolean),
    });
  }

  return (
    <div className="space-y-5">
      <Field label="Course title">
        <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </Field>
      <Field label="Subtitle">
        <input className="input" value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} placeholder="A short, compelling tagline" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value, subcategoryId: '' })}>
            <option value="">Select…</option>
            {cats?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subcategory">
          <select className="input" value={f.subcategoryId} onChange={(e) => setF({ ...f, subcategoryId: e.target.value })} disabled={!parent}>
            <option value="">Select…</option>
            {parent?.children?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Level">
          <select className="input" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
            {['all', 'beginner', 'intermediate', 'advanced'].map((l) => (
              <option key={l} value={l}>
                {l[0].toUpperCase() + l.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Language">
          <input className="input" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} />
        </Field>
      </div>
      <Field label="Course image URL">
        <input className="input" value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} placeholder="https://…" />
        {f.image && <img src={f.image} alt="" className="mt-2 h-32 rounded object-cover" />}
      </Field>
      <Field label="Promo video URL">
        <input className="input" value={f.promoVideo} onChange={(e) => setF({ ...f, promoVideo: e.target.value })} placeholder="https://…mp4" />
      </Field>
      <Field label="Description (HTML allowed)">
        <textarea className="input" rows={6} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>
      <Field label="What students will learn (one per line)">
        <textarea className="input" rows={4} value={f.learningObjectives} onChange={(e) => setF({ ...f, learningObjectives: e.target.value })} />
      </Field>
      <Field label="Requirements (one per line)">
        <textarea className="input" rows={3} value={f.requirements} onChange={(e) => setF({ ...f, requirements: e.target.value })} />
      </Field>
      <Field label="Who this course is for (one per line)">
        <textarea className="input" rows={3} value={f.targetAudience} onChange={(e) => setF({ ...f, targetAudience: e.target.value })} />
      </Field>
      <button onClick={submit} disabled={save.isPending} className="btn-primary">
        <Save className="h-4 w-4" /> Save landing page
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

/* --------------------------- Curriculum --------------------------- */

function CurriculumEditor({ course }: { course: any }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['builder', course.id] });
  const [newSection, setNewSection] = useState('');

  const addSection = useMutation({
    mutationFn: async () => api.post(`/instructor/courses/${course.id}/sections`, { title: newSection }),
    onSuccess: () => {
      setNewSection('');
      refresh();
    },
  });
  const delSection = useMutation({
    mutationFn: async (sid: string) => api.delete(`/instructor/courses/sections/${sid}`),
    onSuccess: refresh,
  });

  return (
    <div>
      <p className="mb-4 text-sm text-ink-500">
        Build your curriculum with sections and lectures. Mark lectures as free previews to let
        prospective students sample your course.
      </p>
      <div className="space-y-4">
        {course.curriculum.map((section: any, i: number) => (
          <div key={section.id} className="rounded-lg border">
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-3">
              <GripVertical className="h-4 w-4 text-gray-400" />
              <span className="font-semibold">
                Section {i + 1}: {section.title}
              </span>
              <button onClick={() => delSection.mutate(section.id)} className="ml-auto text-ink-500 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <LectureList section={section} courseId={course.id} onChange={refresh} />
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
          placeholder="New section title"
          className="input"
        />
        <button onClick={() => newSection && addSection.mutate()} className="btn-primary shrink-0">
          <Plus className="h-4 w-4" /> Add section
        </button>
      </div>
    </div>
  );
}

function LectureList({ section, courseId, onChange }: { section: any; courseId: string; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'video', videoUrl: '', durationSec: 300, isFreePreview: false });

  const add = useMutation({
    mutationFn: async () =>
      api.post(`/instructor/courses/sections/${section.id}/lectures`, {
        title: form.title,
        type: form.type,
        videoUrl: form.videoUrl || undefined,
        durationSec: Number(form.durationSec) || 0,
        isFreePreview: form.isFreePreview,
      }),
    onSuccess: () => {
      setForm({ title: '', type: 'video', videoUrl: '', durationSec: 300, isFreePreview: false });
      setAdding(false);
      onChange();
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const del = useMutation({
    mutationFn: async (lid: string) => api.delete(`/instructor/courses/lectures/${lid}`),
    onSuccess: onChange,
  });
  const toggleFree = useMutation({
    mutationFn: async (lec: any) => api.put(`/instructor/courses/lectures/${lec.id}`, { isFreePreview: !lec.isFreePreview }),
    onSuccess: onChange,
  });

  return (
    <div className="divide-y">
      {section.lectures.map((lec: any) => (
        <div key={lec.id} className="flex items-center gap-2 px-4 py-2 text-sm">
          <span className="flex-1">{lec.title}</span>
          <Badge color="gray">{lec.type}</Badge>
          <button onClick={() => toggleFree.mutate(lec)} className={`badge ${lec.isFreePreview ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {lec.isFreePreview ? 'Free preview' : 'Make preview'}
          </button>
          <button onClick={() => del.mutate(lec.id)} className="text-ink-500 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="space-y-2 bg-gray-50 p-4">
          <input className="input" placeholder="Lecture title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="video">Video</option>
              <option value="article">Article</option>
              <option value="quiz">Quiz</option>
            </select>
            <input className="input" type="number" placeholder="Duration (sec)" value={form.durationSec} onChange={(e) => setForm({ ...form, durationSec: Number(e.target.value) })} />
          </div>
          {form.type === 'video' && (
            <input className="input" placeholder="Video URL (mp4/HLS)" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isFreePreview} onChange={(e) => setForm({ ...form, isFreePreview: e.target.checked })} className="accent-brand-600" />
            Free preview
          </label>
          <div className="flex gap-2">
            <button onClick={() => form.title && add.mutate()} className="btn-primary">
              Add lecture
            </button>
            <button onClick={() => setAdding(false)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex w-full items-center gap-1 px-4 py-2 text-left text-sm text-brand-700 hover:bg-gray-50">
          <Plus className="h-4 w-4" /> Add lecture
        </button>
      )}
    </div>
  );
}

/* --------------------------- Pricing --------------------------- */

function PricingEditor({ course }: { course: any }) {
  const save = useSave(course.id);
  const [priceMajor, setPriceMajor] = useState(String((course.priceCents ?? 0) / 100));
  const [currency, setCurrency] = useState(course.currency ?? 'INR');

  return (
    <div className="max-w-md space-y-5">
      <Field label="Currency">
        <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {['INR', 'USD', 'EUR', 'GBP'].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Price (set 0 for a free course)">
        <input className="input" type="number" min={0} value={priceMajor} onChange={(e) => setPriceMajor(e.target.value)} />
      </Field>
      <button
        onClick={() => save.mutate({ priceCents: Math.round(Number(priceMajor) * 100), currency })}
        disabled={save.isPending}
        className="btn-primary"
      >
        <Save className="h-4 w-4" /> Save pricing
      </button>
      <p className="text-xs text-ink-500">
        You keep a configurable share of each sale (50% default). Manage coupons from the course page once published.
      </p>
    </div>
  );
}

/* --------------------------- Publish --------------------------- */

function PublishPanel({ course, onChange }: { course: any; onChange: () => void }) {
  const submit = useMutation({
    mutationFn: async () => api.post(`/instructor/courses/${course.id}/submit`),
    onSuccess: () => {
      onChange();
      toast.success('Submitted for review!');
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const unpublish = useMutation({
    mutationFn: async () => api.post(`/instructor/courses/${course.id}/unpublish`),
    onSuccess: () => {
      onChange();
      toast.success('Course unpublished');
    },
  });

  const lectureCount = course.curriculum.reduce((n: number, s: any) => n + s.lectures.length, 0);
  const checks = [
    [Boolean(course.title && course.title.length >= 5), 'Title (5+ characters)'],
    [Boolean(course.subtitle), 'Subtitle'],
    [Boolean(course.description && course.description.length >= 100), 'Description (100+ characters)'],
    [Boolean(course.image), 'Course image'],
    [Boolean(course.categoryId), 'Category'],
    [Boolean(course.learningObjectives?.length), 'At least one learning objective'],
    [lectureCount >= 1, 'At least one lecture'],
  ] as const;
  const ready = checks.every(([ok]) => ok);

  return (
    <div className="max-w-lg">
      <h2 className="mb-4 text-xl font-bold">Submit for review</h2>
      <div className="space-y-2 rounded-lg border p-5">
        {checks.map(([ok, label]) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <span className={ok ? 'text-green-600' : 'text-gray-300'}>{ok ? '✓' : '○'}</span>
            <span className={ok ? '' : 'text-ink-500'}>{label}</span>
          </div>
        ))}
      </div>

      {course.status === 'published' ? (
        <button onClick={() => unpublish.mutate()} className="btn-secondary mt-5">
          Unpublish course
        </button>
      ) : course.status === 'review' ? (
        <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Your course is in review. An admin will approve or request changes.
        </p>
      ) : (
        <button onClick={() => submit.mutate()} disabled={!ready || submit.isPending} className="btn-primary mt-5 disabled:opacity-50">
          <Send className="h-4 w-4" /> Submit for review
        </button>
      )}
      {!ready && course.status !== 'published' && (
        <p className="mt-2 text-xs text-ink-500">Complete all items above before submitting.</p>
      )}
    </div>
  );
}
