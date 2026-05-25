import React from 'react';

function SkeletonCard() {
  return (
    <div className="card-vibrancy p-xl">
      <div className="skeleton h-3 w-20 mb-md" />
      <div className="skeleton h-8 w-24 mb-sm" />
      <div className="skeleton h-3 w-16" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <div className="mb-xxl">
        <div className="skeleton h-8 w-56 mb-sm" />
        <div className="skeleton h-3 w-40" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-lg mb-xxl">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="lg:col-span-2 card-vibrancy p-xl">
          <div className="skeleton h-48 w-full" />
        </div>
        <div className="card-vibrancy p-xl">
          <div className="skeleton h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
