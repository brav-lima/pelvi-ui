import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, Clinic } from '@/types/clinic';
import { mockUser, mockClinics } from '@/data/mockData';

interface AuthContextType {
  user: User | null;
  selectedClinic: Clinic | null;
  clinics: Clinic[];
  isAuthenticated: boolean;
  login: (cpf: string, password: string) => Promise<boolean>;
  logout: () => void;
  selectClinic: (clinic: Clinic) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [clinics] = useState<Clinic[]>(mockClinics);

  const login = async (cpf: string, password: string): Promise<boolean> => {
    // Simulate login - in real app, this would be an API call
    if (cpf && password) {
      setUser(mockUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setSelectedClinic(null);
  };

  const selectClinic = (clinic: Clinic) => {
    setSelectedClinic(clinic);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        selectedClinic,
        clinics,
        isAuthenticated: !!user,
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
