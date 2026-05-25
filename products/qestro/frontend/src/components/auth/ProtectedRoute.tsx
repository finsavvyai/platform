/**
 * Protected Route Component
 * Handles authentication and authorization for protected routes
 */

import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { PageLoader } from '../ui/PageLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
  redirectTo = '/login'
}) => {
  const location = useLocation();
  const { isAuthenticated, isLoading, user, checkAuth } = useAuthStore();

  // Check authentication on mount
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      checkAuth();
    }
  }, [isAuthenticated, isLoading, checkAuth]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return <PageLoader />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location }}
        replace
      />
    );
  }

  // Check role-based access if roles are specified
  if (requiredRoles.length > 0 && user) {
    const hasRequiredRole = requiredRoles.includes(user.role);
    if (!hasRequiredRole) {
      return (
        <Navigate
          to="/unauthorized"
          state={{ from: location }}
          replace
        />
      );
    }
  }

  // User is authenticated and authorized
  return <>{children}</>;
};

export default ProtectedRoute;
