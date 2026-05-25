import { CardSkeleton, TableSkeleton, ChartSkeleton, Skeleton } from '@/components/Skeleton';

export default function SecurityLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-56 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Score + stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Events table */}
      <TableSkeleton rows={5} />
    </div>
  );
}
