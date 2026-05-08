import { type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@/types/clinic';

type Role = User['role'];

interface RoleGuardProps {
  /** Roles allowed to see the children */
  roles: Role[];
  children: ReactNode;
  /** Optional fallback when role doesn't match */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on the current user's role.
 * If the user's role is not in the `roles` array, renders the fallback (or nothing).
 */
export function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook to check if the current user has one of the given roles.
 */
export function useHasRole(...roles: Role[]): boolean {
  const { user } = useAuth();
  return !!user && roles.includes(user.role);
}
