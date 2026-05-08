import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@/types/clinic';

type Role = User['role'];

interface ProtectedRouteProps {
  roles: Role[];
  children: React.ReactNode;
}

/**
 * Route-level guard: redirects to /dashboard if the user's role is not allowed.
 */
export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user } = useAuth();

  if (user && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
