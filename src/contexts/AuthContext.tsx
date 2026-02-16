import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, Clinic, LoginResponseMulti } from '@/types/clinic';
import { authApi, setToken, setRefreshToken, removeToken, getToken, ApiError } from '@/lib/api';

interface LoginResult {
  success: boolean;
  multiClinic: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  selectedClinic: Clinic | null;
  clinics: Clinic[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (cpf: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  selectClinic: (organizationId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Multi-clinic flow: store personId temporarily for select-organization call
  const [pendingPersonId, setPendingPersonId] = useState<string | null>(null);

  const logout = useCallback(() => {
    removeToken();
    queryClient.clear();
    setUser(null);
    setSelectedClinic(null);
    setClinics([]);
    setPendingPersonId(null);
  }, [queryClient]);

  // Listen for automatic logout triggered by expired refresh token
  useEffect(() => {
    const handleForceLogout = () => logout();
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, [logout]);

  // Restore session from stored token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    authApi
      .me()
      .then((profile) => {
        if (profile.person && profile.organization) {
          setUser({
            id: profile.person.id,
            name: profile.person.name,
            email: profile.person.email,
            cpf: profile.person.cpf,
            role: profile.role,
          });
          setSelectedClinic(profile.organization);
        } else {
          logout();
        }
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [logout]);

  const login = async (cpf: string, password: string): Promise<LoginResult> => {
    const cleanCpf = cpf.replace(/\D/g, '');

    try {
      const response = await authApi.login(cleanCpf, password);

      if (response.accessToken) {
        // Single clinic — token received immediately
        setToken(response.accessToken);
        setRefreshToken(response.refreshToken);
        setUser({
          id: response.person.id,
          name: response.person.name,
          email: response.person.email,
          cpf: response.person.cpf,
          role: response.role,
        });
        setSelectedClinic(response.organization);
        return { success: true, multiClinic: false };
      }

      // Multi-clinic — no token yet, user must choose
      const multiResponse = response as LoginResponseMulti;
      setPendingPersonId(multiResponse.person.id);
      setUser({
        id: multiResponse.person.id,
        name: multiResponse.person.name,
        email: multiResponse.person.email,
        cpf: multiResponse.person.cpf,
        role: 'PROFESSIONAL', // temporary, will be set after org selection
      });
      setClinics(
        multiResponse.organizations.map((ou) => ou.organization),
      );
      return { success: true, multiClinic: true };
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Erro ao fazer login. Tente novamente.';
      return { success: false, multiClinic: false, error: message };
    }
  };

  const selectClinic = async (organizationId: string): Promise<boolean> => {
    if (!pendingPersonId && !user) return false;
    const personId = pendingPersonId || user!.id;

    try {
      const response = await authApi.selectOrganization(personId, organizationId);
      setToken(response.accessToken);
      setRefreshToken(response.refreshToken);
      setUser({
        id: response.person.id,
        name: response.person.name,
        email: response.person.email,
        cpf: response.person.cpf,
        role: response.role,
      });
      setSelectedClinic(response.organization);
      setPendingPersonId(null);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        selectedClinic,
        clinics,
        isAuthenticated: !!user && !!getToken(),
        isLoading,
        login,
        logout,
        selectClinic,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
