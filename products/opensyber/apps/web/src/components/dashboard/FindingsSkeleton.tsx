import { Skeleton, SkeletonCard } from './Skeleton';

export function FindingsSkeleton() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="mb-2 h-9 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Summary cards skeleton */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="p-4">
            <Skeleton className="mb-2 h-8 w-12" />
            <Skeleton className="h-3 w-16" />
          </SkeletonCard>
        ))}
      </div>

      {/* Filters skeleton */}
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Table skeleton */}
      <div className="overflow-x-auto rounded border border-border bg-panel/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-secondary">
              {Array.from({ length: 6 }).map((_, i) => (
                <th key={i} className="px-6 py-3">
                  <Skeleton className="h-4 w-24" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-3"><Skeleton className="h-5 w-20" /></td>
                <td className="px-6 py-3"><Skeleton className="h-4 w-40" /></td>
                <td className="px-6 py-3"><Skeleton className="h-4 w-32" /></td>
                <td className="px-6 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-6 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-6 py-3">
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
