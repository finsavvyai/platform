export default function SsoLoading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-10 w-40 animate-pulse rounded-lg bg-surface" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-surface" />
      </div>
      <div className="rounded border border-border p-6 space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-surface" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-surface" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-surface" />
        <div className="h-32 w-full animate-pulse rounded-lg bg-surface" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-surface" />
      </div>
    </div>
  );
}
