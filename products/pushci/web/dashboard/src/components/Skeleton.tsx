// Reusable skeleton loaders for loading states.

export function SkeletonCard({ height = 'h-20' }: { height?: string }) {
  return <div className={`rounded-xl ${height} shimmer`} />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg">
      <div className="w-8 h-8 rounded-full shimmer shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/3 rounded shimmer" />
        <div className="h-2.5 w-1/3 rounded shimmer" />
      </div>
      <div className="h-6 w-16 rounded-full shimmer" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => <SkeletonRow key={i} />)}
    </div>
  );
}

export function SkeletonGrid({ count = 6, height = 'h-44' }: { count?: number; height?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} height={height} />)}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="rounded-xl border border-surface-border bg-surface-card p-5">
          <div className="h-3 w-20 rounded shimmer mb-3" />
          <div className="h-7 w-16 rounded shimmer mb-2" />
          <div className="h-2 w-24 rounded shimmer" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="h-3 w-28 rounded shimmer mb-4" />
      <div className="h-48 rounded-lg shimmer" />
    </div>
  );
}
