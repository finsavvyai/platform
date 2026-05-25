export default function UptimeLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-surface" />
      <div className="h-40 rounded bg-surface/50" />
      <div className="h-64 rounded bg-surface/50" />
    </div>
  );
}
