// Protected Route Component for React

import * as React from 'react';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredRoles?: string[];
}

export function ProtectedRoute({
  children,
  fallback,
  requiredRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <>{fallback ?? <div>Loading...</div>}</>;
  }

  if (!isAuthenticated) {
    return <>{fallback ?? <div>Please log in to continue.</div>}</>;
  }

  if (requiredRoles && requiredRoles.length > 0 && user) {
    const hasRequiredRole = requiredRoles.some((role) =>
      user.roles.includes(role),
    );
    if (!hasRequiredRole) {
      return <>{fallback ?? <div>Access denied.</div>}</>;
    }
  }

  return <>{children}</>;
}
