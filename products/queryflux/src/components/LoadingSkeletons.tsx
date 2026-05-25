/**
 * Loading Skeleton Components
 *
 * Provides consistent loading states across the application
 */

// ============================================================================
// Table Skeleton
// ============================================================================

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={j}
              className="h-8 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Card Skeleton
// ============================================================================

interface CardSkeletonProps {
  showAvatar?: boolean;
  showTitle?: boolean;
  showDescription?: boolean;
  lines?: number;
}

export function CardSkeleton({
  showAvatar = true,
  showTitle = true,
  showDescription = true,
  lines = 3,
}: CardSkeletonProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center gap-4">
        {showAvatar && (
          <div className="h-12 w-12 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        )}
        <div className="flex-1 space-y-2">
          {showTitle && (
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          )}
          {showDescription && (
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800"
            style={{ width: `${Math.max(50, Math.random() * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// List Skeleton
// ============================================================================

interface ListSkeletonProps {
  items?: number;
  showAvatar?: boolean;
}

export function ListSkeleton({ items = 5, showAvatar = true }: ListSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          {showAvatar && (
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
          )}
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Metric Card Skeleton
// ============================================================================

export function MetricCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="mb-2 h-8 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-3 w-1/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

