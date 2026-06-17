import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronDown,
  CheckCircle2,
  Circle,
  PlayCircle,
  FileText,
  Award,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { toast } from '@/store/toast';
import { clock } from '@/lib/format';
import { PageLoader, ProgressBar, Avatar, Stars } from '@/components/ui';
import type { Section, Lecture } from '@/lib/types';

interface PlayerData {
  course: { id: string; title: string; slug: string; instructorId: string };
  enrollment: { id: string; progressPct: number; completedAt?: string | null };
  curriculum: Section[];
  certificate: { serial: string; verifyUrl: string } | null;
}

export function PlayerPage() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'qna' | 'notes' | 'reviews'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);

  const { data, isLoading } = useQuery({
    queryKey: ['player', slug],
    queryFn: async () => (await api.get(`/learning/${slug}`)).data as PlayerData,
    enabled: !!slug,
  });

  const flat = useMemo(() => data?.curriculum.flatMap((s) => s.lectures) ?? [], [data]);
  const current = flat.find((l) => l.id === currentId) ?? flat[0];
  const currentIdx = flat.findIndex((l) => l.id === current?.id);

  useEffect(() => {
    if (data && !currentId && flat.length) {
      // resume at first incomplete lecture
      const next = flat.find((l) => !l.completed) ?? flat[0];
      setCurrentId(next.id);
    }
  }, [data, flat, currentId]);

  const saveProgress = useMutation({
    mutationFn: async (vars: { lectureId: string; completed?: boolean; lastPositionSec?: number }) =>
      (await api.post(`/learning/lectures/${vars.lectureId}/progress`, vars)).data,
    onSuccess: (res) => {
      qc.setQueryData(['player', slug], (old: PlayerData | undefined) =>
        old ? { ...old, enrollment: { ...old.enrollment, progressPct: res.progressPct } } : old
      );
    },
  });

  const genCert = useMutation({
    mutationFn: async () => (await api.post(`/learning/${slug}/certificate`)).data.certificate,
    onSuccess: (cert) => {
      qc.setQueryData(['player', slug], (old: PlayerData | undefined) => (old ? { ...old, certificate: cert } : old));
      toast.success('Certificate issued! 🎉');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  function markComplete(lectureId: string, completed = true) {
    saveProgress.mutate({ lectureId, completed });
    qc.setQueryData(['player', slug], (old: PlayerData | undefined) => {
      if (!old) return old;
      return {
        ...old,
        curriculum: old.curriculum.map((s) => ({
          ...s,
          lectures: s.lectures.map((l) => (l.id === lectureId ? { ...l, completed } : l)),
        })),
      };
    });
  }

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v || !current) return;
    if (Date.now() - lastSaved.current > 8000) {
      lastSaved.current = Date.now();
      saveProgress.mutate({ lectureId: current.id, lastPositionSec: Math.floor(v.currentTime) });
    }
  }

  function goTo(idx: number) {
    if (idx >= 0 && idx < flat.length) setCurrentId(flat[idx].id);
  }

  if (isLoading || !data) return <PageLoader />;

  const pct = data.enrollment.progressPct;

  return (
    <div className="flex min-h-screen flex-col bg-ink-900 text-white">
      {/* top bar */}
      <header className="flex h-14 items-center gap-3 border-b border-white/10 px-4">
        <Link to="/learning" className="flex items-center gap-1 text-sm hover:text-brand-300">
          <ChevronLeft className="h-4 w-4" /> My learning
        </Link>
        <h1 className="truncate font-semibold">{data.course.title}</h1>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden w-40 sm:block">
            <ProgressBar value={pct} />
          </div>
          <span className="text-xs text-gray-300">{pct}% complete</span>
          <button onClick={() => setSidebarOpen((o) => !o)} className="btn-secondary py-1 text-ink-900">
            {sidebarOpen ? 'Hide' : 'Show'} content
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* main player area */}
        <div className="flex-1 bg-white text-ink-900">
          <div className="bg-black">
            {current?.type === 'quiz' ? (
              <QuizPanel lectureId={current.id} onPass={() => markComplete(current.id)} />
            ) : current?.videoUrl ? (
              <video
                ref={videoRef}
                key={current.id}
                src={current.videoUrl}
                controls
                autoPlay
                onTimeUpdate={onTimeUpdate}
                onEnded={() => {
                  markComplete(current.id);
                  if (currentIdx < flat.length - 1) goTo(currentIdx + 1);
                }}
                onLoadedMetadata={(e) => {
                  if (current.lastPositionSec) e.currentTarget.currentTime = current.lastPositionSec;
                }}
                className="mx-auto aspect-video max-h-[70vh] w-full bg-black"
              />
            ) : current?.articleBody ? (
              <div className="mx-auto max-w-3xl bg-white p-8" dangerouslySetInnerHTML={{ __html: current.articleBody }} />
            ) : (
              <div className="flex aspect-video items-center justify-center text-white">No content</div>
            )}
          </div>

          {/* nav + complete */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <button onClick={() => goTo(currentIdx - 1)} disabled={currentIdx <= 0} className="btn-secondary disabled:opacity-40">
              <ArrowLeft className="h-4 w-4" /> Previous
            </button>
            <h2 className="hidden truncate px-4 font-semibold sm:block">{current?.title}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => markComplete(current.id, !current.completed)}
                className={current.completed ? 'btn-secondary' : 'btn-primary'}
              >
                {current.completed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Completed
                  </>
                ) : (
                  'Mark complete'
                )}
              </button>
              <button onClick={() => goTo(currentIdx + 1)} disabled={currentIdx >= flat.length - 1} className="btn-secondary disabled:opacity-40">
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* tabs */}
          <div className="border-b px-4">
            <div className="flex gap-4">
              {(['overview', 'qna', 'notes', 'reviews'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-1 py-3 text-sm font-semibold capitalize ${
                    tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500'
                  }`}
                >
                  {t === 'qna' ? 'Q&A' : t}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {tab === 'overview' && (
              <div>
                <h3 className="text-lg font-bold">{current?.title}</h3>
                <p className="mt-1 text-sm text-ink-500">
                  {pct >= 100 ? 'You finished this course! 🎉' : 'Keep going — you are making progress.'}
                </p>
                {pct >= 100 && (
                  <div className="mt-4 rounded-lg border bg-amber-50 p-4">
                    <div className="flex items-center gap-3">
                      <Award className="h-8 w-8 text-amber-500" />
                      <div className="flex-1">
                        <p className="font-bold">Certificate of completion</p>
                        {data.certificate ? (
                          <p className="text-sm text-ink-700">
                            Serial: {data.certificate.serial} ·{' '}
                            <Link to={data.certificate.verifyUrl} className="text-brand-700 underline">
                              verify
                            </Link>
                          </p>
                        ) : (
                          <p className="text-sm text-ink-700">You're eligible — claim it now.</p>
                        )}
                      </div>
                      {!data.certificate && (
                        <button onClick={() => genCert.mutate()} disabled={genCert.isPending} className="btn-primary">
                          Get certificate
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {tab === 'qna' && current && <QnAPanel lectureId={current.id} />}
            {tab === 'notes' && current && <NotesPanel courseId={data.course.id} lectureId={current.id} videoRef={videoRef} />}
            {tab === 'reviews' && <ReviewPanel slug={slug!} />}
          </div>
        </div>

        {/* curriculum sidebar */}
        {sidebarOpen && (
          <aside className="w-full shrink-0 overflow-y-auto border-l border-white/10 bg-white text-ink-900 lg:w-96">
            <div className="border-b p-3 font-bold">Course content</div>
            {data.curriculum.map((section, i) => (
              <SidebarSection
                key={section.id}
                section={section}
                index={i}
                currentId={current?.id}
                onSelect={setCurrentId}
                onToggleComplete={markComplete}
              />
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}

function SidebarSection({
  section,
  index,
  currentId,
  onSelect,
  onToggleComplete,
}: {
  section: Section;
  index: number;
  currentId?: string;
  onSelect: (id: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const done = section.lectures.filter((l) => l.completed).length;
  return (
    <div className="border-b">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between bg-gray-50 px-3 py-2.5 text-left">
        <span className="font-semibold">
          Section {index + 1}: {section.title}
        </span>
        <span className="flex items-center gap-2 text-xs text-ink-500">
          {done}/{section.lectures.length}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
        </span>
      </button>
      {open && (
        <ul>
          {section.lectures.map((lec) => (
            <li
              key={lec.id}
              className={`flex items-start gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                currentId === lec.id ? 'bg-brand-50' : ''
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleComplete(lec.id, !lec.completed);
                }}
                className="mt-0.5"
              >
                {lec.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-brand-600" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-300" />
                )}
              </button>
              <button onClick={() => onSelect(lec.id)} className="flex-1 text-left">
                <span className="flex items-center gap-1">
                  {lec.type === 'quiz' ? <FileText className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
                  {lec.title}
                </span>
                {lec.durationSec > 0 && <span className="text-xs text-ink-500">{clock(lec.durationSec)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------- Quiz ---------------------------- */

function QuizPanel({ lectureId, onPass }: { lectureId: string; onPass: () => void }) {
  const { data } = useQuery({
    queryKey: ['quiz', lectureId],
    queryFn: async () => (await api.get(`/learning/lectures/${lectureId}/quiz`)).data,
  });
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [result, setResult] = useState<any>(null);

  const submit = useMutation({
    mutationFn: async () => (await api.post(`/learning/quiz/${data.quiz.id}/submit`, { answers })).data,
    onSuccess: (res) => {
      setResult(res);
      if (res.passed) onPass();
    },
  });

  if (!data) return <div className="flex aspect-video items-center justify-center text-white">Loading quiz…</div>;

  return (
    <div className="mx-auto max-h-[70vh] w-full max-w-2xl overflow-y-auto bg-white p-6">
      <h3 className="mb-4 text-lg font-bold">{data.quiz.title}</h3>
      {data.questions.map((q: any, qi: number) => (
        <div key={q.id} className="mb-5">
          <p className="font-semibold">
            {qi + 1}. {q.prompt}
          </p>
          <div className="mt-2 space-y-1.5">
            {q.options.map((opt: string, oi: number) => {
              const selected = (answers[q.id] ?? []).includes(oi);
              const correct = result?.results?.find((r: any) => r.questionId === q.id)?.correctAnswers?.includes(oi);
              return (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${
                    result ? (correct ? 'border-green-400 bg-green-50' : selected ? 'border-red-300 bg-red-50' : '') : selected ? 'border-brand-400 bg-brand-50' : ''
                  }`}
                >
                  <input
                    type={q.type === 'multi' ? 'checkbox' : 'radio'}
                    name={q.id}
                    checked={selected}
                    disabled={!!result}
                    onChange={() =>
                      setAnswers((a) => ({
                        ...a,
                        [q.id]: q.type === 'multi' ? toggle(a[q.id] ?? [], oi) : [oi],
                      }))
                    }
                    className="accent-brand-600"
                  />
                  {opt}
                </label>
              );
            })}
          </div>
          {result && (
            <p className="mt-1 text-xs text-ink-500">
              {result.results.find((r: any) => r.questionId === q.id)?.explanation}
            </p>
          )}
        </div>
      ))}
      {result ? (
        <div className={`rounded-lg p-4 ${result.passed ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="font-bold">
            {result.passed ? '✓ Passed' : '✗ Try again'} — {result.scorePct}% ({result.correct}/{result.total})
          </p>
          {!result.passed && (
            <button onClick={() => { setResult(null); setAnswers({}); }} className="btn-secondary mt-2">
              Retake quiz
            </button>
          )}
        </div>
      ) : (
        <button onClick={() => submit.mutate()} className="btn-primary">
          Submit quiz
        </button>
      )}
    </div>
  );
}

function toggle(arr: number[], v: number) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/* ---------------------------- Q&A ---------------------------- */

function QnAPanel({ lectureId }: { lectureId: string }) {
  const qc = useQueryClient();
  const [question, setQuestion] = useState('');
  const { data } = useQuery({
    queryKey: ['qna', lectureId],
    queryFn: async () => (await api.get(`/lectures/${lectureId}/qna`)).data.threads as any[],
  });
  const ask = useMutation({
    mutationFn: async () => api.post(`/lectures/${lectureId}/qna`, { question }),
    onSuccess: () => {
      setQuestion('');
      qc.invalidateQueries({ queryKey: ['qna', lectureId] });
      toast.success('Question posted');
    },
  });
  const upvote = useMutation({
    mutationFn: async (id: string) => api.post(`/qna/${id}/upvote`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qna', lectureId] }),
  });

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this lecture…"
          className="input"
        />
        <button onClick={() => question && ask.mutate()} className="btn-primary shrink-0">
          Ask
        </button>
      </div>
      <div className="space-y-4">
        {data?.map((t) => (
          <div key={t.id} className="rounded-lg border p-3">
            <div className="flex items-start gap-2">
              <Avatar name={t.userName ?? 'User'} src={t.userAvatar} size={32} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{t.userName}</p>
                <p className="text-sm">{t.question}</p>
              </div>
              <button onClick={() => upvote.mutate(t.id)} className="text-xs text-ink-500 hover:text-brand-600">
                ▲ {t.upvotes}
              </button>
            </div>
            {t.answers?.map((a: any) => (
              <div key={a.id} className="ml-10 mt-2 border-l-2 pl-3 text-sm">
                <span className="font-semibold">{a.userName}:</span> {a.body}
              </div>
            ))}
          </div>
        ))}
        {(!data || data.length === 0) && <p className="text-sm text-ink-500">No questions yet.</p>}
      </div>
    </div>
  );
}

/* ---------------------------- Notes ---------------------------- */

function NotesPanel({
  courseId,
  lectureId,
  videoRef,
}: {
  courseId: string;
  lectureId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const { data } = useQuery({
    queryKey: ['notes', courseId],
    queryFn: async () => (await api.get(`/learning/${courseId}/notes`)).data.notes as any[],
  });
  const add = useMutation({
    mutationFn: async () =>
      api.post('/learning/notes', {
        lectureId,
        timestampSec: Math.floor(videoRef.current?.currentTime ?? 0),
        body,
      }),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['notes', courseId] });
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/learning/notes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', courseId] }),
  });

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Add a note at ${clock(Math.floor(videoRef.current?.currentTime ?? 0))}…`}
          className="input"
        />
        <button onClick={() => body && add.mutate()} className="btn-primary shrink-0">
          Save
        </button>
      </div>
      <div className="space-y-2">
        {data?.map((n) => (
          <div key={n.id} className="flex items-start gap-2 rounded border p-2 text-sm">
            <button
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime = n.timestampSec;
              }}
              className="badge bg-brand-100 text-brand-700"
            >
              {clock(n.timestampSec)}
            </button>
            <span className="flex-1">{n.body}</span>
            <button onClick={() => del.mutate(n.id)} className="text-ink-500 hover:text-red-600">
              ✕
            </button>
          </div>
        ))}
        {(!data || data.length === 0) && <p className="text-sm text-ink-500">No notes yet.</p>}
      </div>
    </div>
  );
}

/* ---------------------------- Reviews ---------------------------- */

function ReviewPanel({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const { data: mine } = useQuery({
    queryKey: ['my-review', slug],
    queryFn: async () => (await api.get(`/courses/${slug}/my-review`)).data.review,
  });
  const [rating_, setRating] = useState(5);
  const [body, setBody] = useState('');
  useEffect(() => {
    if (mine) {
      setRating(mine.rating);
      setBody(mine.body ?? '');
    }
  }, [mine]);

  const submit = useMutation({
    mutationFn: async () => api.post(`/courses/${slug}/reviews`, { rating: rating_, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-review', slug] });
      toast.success('Review saved!');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className="max-w-lg">
      <h3 className="mb-2 font-bold">{mine ? 'Edit your review' : 'Leave a review'}</h3>
      <div className="mb-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => setRating(s)} className="text-2xl">
            <span className={s <= rating_ ? 'text-amber-400' : 'text-gray-300'}>★</span>
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Share your experience…"
        className="input"
      />
      <button onClick={() => submit.mutate()} className="btn-primary mt-2">
        {mine ? 'Update review' : 'Submit review'}
      </button>
    </div>
  );
}
