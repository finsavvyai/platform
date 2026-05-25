import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../ui/PageLoader';
import { canAccess } from './navItems';

interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return <PageLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !canAccess(user?.role ?? '', requiredRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
