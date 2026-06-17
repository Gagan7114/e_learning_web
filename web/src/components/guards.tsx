import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { PageLoader } from './ui';

/** Require any authenticated user. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

/** Require a specific role. */
export function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const { user, ready, has } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!has(role))
    return (
      <div className="container-page py-24 text-center">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-ink-500">You need the “{role}” role to view this page.</p>
      </div>
    );
  return <>{children}</>;
}
