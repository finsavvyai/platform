// Display helpers for the /enterprise dashboard page.

export function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

export function formatRate(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatFrequency(perDay: number): string {
  if (!Number.isFinite(perDay) || perDay <= 0) return '0 / day';
  if (perDay < 1) return `${(perDay * 7).toFixed(1)} / week`;
  return `${perDay.toFixed(1)} / day`;
}

export function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
