import { Skeleton } from '@/components/Skeleton';

export default function MarketplaceLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <Skeleton className="h-10 w-64 mx-auto mb-3" />
        <Skeleton className="h-4 w-96 mx-auto" />
      </div>

      {/* Search bar */}
      <Skeleton className="h-10 w-full max-w-md mx-auto" />

      {/* Skill cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded border border-border bg-panel/30 p-6 space-y-3"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-2/3 mb-2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
