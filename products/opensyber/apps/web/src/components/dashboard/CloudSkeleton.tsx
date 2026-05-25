import { Skeleton } from './Skeleton';

export function CloudSkeleton() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="mb-2 h-9 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Table skeleton */}
      <div className="overflow-x-auto rounded border border-border bg-panel/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} className="px-6 py-3 text-left">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                <td className="px-6 py-3"><Skeleton className="h-5 w-24" /></td>
                <td className="px-6 py-3"><Skeleton className="h-4 w-32" /></td>
                <td className="px-6 py-3"><Skeleton className="h-5 w-20" /></td>
                <td className="px-6 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-6 py-3 text-right">
                  <div className="ml-auto flex gap-2">
                    <Skeleton className="h-8 w-8" />
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
