export default function AdminLoading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-10 w-48 animate-pulse rounded-lg bg-surface" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-surface" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded border border-border bg-panel/30" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded border border-border bg-panel/30" />
    </div>
  );
}
