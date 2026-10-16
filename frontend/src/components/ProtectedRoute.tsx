import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

// Wraps a page and redirects to /login if not authenticated.
// Pass roles to restrict to real user roles, e.g. <ProtectedRoute roles={['admin']}>.
export const ProtectedRoute = ({ children, roles }: { children: ReactNode; roles?: string[] }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Checking session…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="app-layout">
        <main className="content">
          <div className="empty-state">
            <h3>Access denied</h3>
            <p>Your role ({user.role}) cannot access this page.</p>
          </div>
        </main>
      </div>
    );
  }
  return <>{children}</>;
};
