interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse motion-reduce:animate-none rounded-lg bg-surface/60 ${className}`}
      role="presentation"
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded border border-border bg-panel/30 p-6 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded border border-border bg-panel/30 overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-1/4" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border/50 px-4 py-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/6" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <Skeleton className="h-4 w-1/4 mb-4" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
