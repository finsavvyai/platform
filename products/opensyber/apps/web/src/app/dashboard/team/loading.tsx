export default function TeamLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-10 w-32 animate-pulse rounded-lg bg-surface" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-surface" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-lg bg-surface" />
      </div>
      <div className="rounded border border-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-border/50 px-4 py-4 last:border-b-0">
            <div className="h-4 w-24 animate-pulse rounded bg-surface" />
            <div className="h-4 w-40 animate-pulse rounded bg-surface" />
            <div className="h-4 w-16 animate-pulse rounded bg-surface" />
            <div className="h-4 w-20 animate-pulse rounded bg-surface" />
          </div>
        ))}
      </div>
    </div>
  );
}
