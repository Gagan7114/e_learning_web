/** Format an integer minor-unit amount (cents/paise) as currency. */
export function money(minor: number, currency = 'INR'): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: major % 1 === 0 ? 0 : 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

/** Rating stored x100 (472) -> 4.7 */
export function rating(x100: number): number {
  return Math.round(x100 / 10) / 10;
}

/** Seconds -> "1h 23m" or "12m" or "45s". */
export function duration(totalSec: number): string {
  if (!totalSec) return '0m';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** Seconds -> "mm:ss" for the player. */
export function clock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function timeAgo(date: string | Date): string {
  const d = new Date(date).getTime();
  const diff = Date.now() - d;
  const days = Math.floor(diff / 86400000);
  if (days > 30) return new Date(date).toLocaleDateString();
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.floor(diff / 60000);
  if (mins >= 1) return `${mins}m ago`;
  return 'just now';
}
