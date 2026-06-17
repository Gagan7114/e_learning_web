import { Star, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { rating as toRating } from '@/lib/format';

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  // value is x100 (e.g. 470). Render 5 stars with partial fill via overlay.
  const r = toRating(value);
  return (
    <span className="inline-flex items-center" aria-label={`${r} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, r - i));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute text-amber-400" />
            <span className="absolute overflow-hidden" style={{ width: `${fill * 100}%`, height: size }}>
              <Star size={size} className="text-amber-400 fill-amber-400" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function RatingInline({ avg, count }: { avg: number; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="font-semibold text-amber-700">{toRating(avg).toFixed(1)}</span>
      <Stars value={avg} />
      {count > 0 && <span className="text-ink-500">({count.toLocaleString()})</span>}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-8 w-8 text-brand-600" />
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  if (src)
    return (
      <img
        src={src}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-brand-600 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}

export function EmptyState({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-16 text-center">
      {icon && <div className="mb-3 text-gray-400">{icon}</div>}
      <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      {subtitle && <p className="mt-1 max-w-md text-sm text-ink-500">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Badge({
  children,
  color = 'gray',
}: {
  children: React.ReactNode;
  color?: 'gray' | 'green' | 'amber' | 'red' | 'brand' | 'blue';
}) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
    brand: 'bg-brand-100 text-brand-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={clsx('badge', colors[color])}>{children}</span>;
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-video w-full rounded-md bg-gray-200" />
      <div className="mt-2 h-4 w-3/4 rounded bg-gray-200" />
      <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-1/4 rounded bg-gray-200" />
    </div>
  );
}
