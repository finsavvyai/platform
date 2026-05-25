/**
 * Loading Spinners, Full-Page Loader, and App-Level Skeletons
 */

import { MetricCardSkeleton, TableSkeleton } from './LoadingSkeletons';

// ============================================================================
// Query Editor Skeleton
// ============================================================================

export function QueryEditorSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="h-10 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-10 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="ml-auto h-10 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-96 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}

// ============================================================================
// Connection List Skeleton
// ============================================================================

export function ConnectionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="h-12 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-8 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Dashboard Skeleton
// ============================================================================

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
      <div>
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <TableSkeleton rows={5} columns={5} />
      </div>
    </div>
  );
}

// ============================================================================
// Inline Text Skeleton
// ============================================================================

interface TextSkeletonProps {
  width?: string;
  height?: string;
}

export function TextSkeleton({ width = '100%', height = '1rem' }: TextSkeletonProps) {
  return (
    <div
      className="animate-pulse rounded bg-gray-200 dark:bg-gray-700"
      style={{ width, height }}
    />
  );
}

// ============================================================================
// Spinner
// ============================================================================

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeClasses = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };

  return (
    <div
      className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ============================================================================
// Full Page Loader
// ============================================================================

interface FullPageLoaderProps {
  message?: string;
}

export function FullPageLoader({ message = 'Loading...' }: FullPageLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
}
