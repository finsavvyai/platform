import React, { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';

const EntityDetail = lazy(() => import('../pages/EntityDetail'));

const Loading = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
  </div>
);

export const entityRoutes: RouteObject[] = [
  {
    path: '/entities/:id',
    element: (
      <Suspense fallback={<Loading />}>
        <EntityDetail />
      </Suspense>
    ),
  },
];
