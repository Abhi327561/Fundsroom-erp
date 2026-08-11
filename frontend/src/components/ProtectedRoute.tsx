import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

// Wraps a page and redirects to /login if not authenticated.
// Usage: <ProtectedRoute><Dashboard /></ProtectedRoute>
export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};
