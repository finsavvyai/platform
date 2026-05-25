import { CardSkeleton, Skeleton } from '@/components/Skeleton';

export default function SettingsLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-36 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Settings cards */}
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
