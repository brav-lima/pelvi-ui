import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, Clinic, LoginResponseMulti, LoginResponseSingle } from '@/types/clinic';
import { authApi, ApiError } from '@/lib/api';

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

function isMultiClinicResponse(
  response: LoginResponseSingle | LoginResponseMulti,
): response is LoginResponseMulti {
  return 'organizations' in response;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Multi-clinic flow: store personId temporarily for select-organization call
  const [pendingPersonId, setPendingPersonId] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    queryClient.clear();
    setUser(null);
    setSelectedClinic(null);
    setClinics([]);
    setPendingPersonId(null);
  }, [queryClient]);

  const logout = useCallback(() => {
    void authApi.logout().catch(() => undefined);
    clearSession();
  }, [clearSession]);

  // Listen for automatic logout triggered by expired/invalid session
  useEffect(() => {
    const handleForceLogout = () => clearSession();
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, [clearSession]);

  // Restore session from httpOnly cookie on mount
  useEffect(() => {
    authApi
      .me()
      .then((profile) => {
        if (profile.person && profile.organization && profile.role) {
          setUser({
            id: profile.person.id,
            name: profile.person.name,
            email: profile.person.email,
            cpf: profile.person.cpf,
            role: profile.role,
          });
          setSelectedClinic(profile.organization);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (cpf: string, password: string): Promise<LoginResult> => {
    const cleanCpf = cpf.replace(/\D/g, '');

    try {
      const response = await authApi.login(cleanCpf, password);

      if (isMultiClinicResponse(response)) {
        // Multi-clinic — no cookies set yet, user must choose
        setPendingPersonId(response.person.id);
        setUser({
          id: response.person.id,
          name: response.person.name,
          email: response.person.email,
          cpf: response.person.cpf,
          role: 'PROFESSIONAL', // temporary, will be set after org selection
        });
        setClinics(response.organizations.map((ou) => ou.organization));
        return { success: true, multiClinic: true };
      }

      // Single clinic — auth cookies were set by the server
      setUser({
        id: response.person.id,
        name: response.person.name,
        email: response.person.email,
        cpf: response.person.cpf,
        role: response.role,
      });
      setSelectedClinic(response.organization);
      return { success: true, multiClinic: false };
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
        isAuthenticated: !!user && !!selectedClinic,
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
