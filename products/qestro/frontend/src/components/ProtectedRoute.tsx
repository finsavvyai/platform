import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: string;
  requirePlan?: string;
}

export default function ProtectedRoute({ 
  children, 
  requireRole, 
  requirePlan 
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireRole && user?.role !== requireRole && user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Access Denied</h3>
          <p className="mt-2 text-sm text-gray-500">
            You don't have permission to access this page.
            {requireRole && ` This page requires ${requireRole} role.`}
          </p>
          <div className="mt-6">
            <button
              onClick={() => window.history.back()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (requirePlan && user?.subscription?.plan) {
    const planHierarchy = { free: 0, pro: 1, enterprise: 2 };
    const userPlanLevel = planHierarchy[user.subscription.plan as keyof typeof planHierarchy] || 0;
    const requiredPlanLevel = planHierarchy[requirePlan as keyof typeof planHierarchy] || 0;

    if (userPlanLevel < requiredPlanLevel) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Upgrade Required</h3>
            <p className="mt-2 text-sm text-gray-500">
              This feature requires a {requirePlan} plan or higher.
              Your current plan: {user.subscription.plan}
            </p>
            <div className="mt-6 flex flex-col space-y-3">
              <button
                onClick={() => window.location.href = '/pricing'}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Upgrade Now
              </button>
              <button
                onClick={() => window.history.back()}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
