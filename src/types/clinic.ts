export interface User {
  id: string;
  name: string;
  email: string | null;
  cpf: string;
  role: 'ADMIN' | 'PROFESSIONAL' | 'RECEPTIONIST';
}

export interface Clinic {
  id: string;
  name: string;
  cnpj?: string;
  settings?: Record<string, unknown>;
}

// Auth API response types
export interface LoginResponseSingle {
  accessToken: string;
  person: { id: string; cpf: string; name: string; email: string | null };
  organization: Clinic;
  role: User['role'];
}

export interface LoginResponseMulti {
  accessToken: null;
  person: { id: string; cpf: string; name: string; email: string | null };
  organizations: Array<{
    id: string;
    organizationId: string;
    personId: string;
    role: User['role'];
    active: boolean;
    organization: Clinic;
  }>;
}

export type LoginResponse = LoginResponseSingle | LoginResponseMulti;

export interface SelectOrgResponse {
  accessToken: string;
  person: { id: string; cpf: string; name: string; email: string | null };
  organization: Clinic;
  role: User['role'];
}

export interface ProfileResponse {
  person: { id: string; cpf: string; name: string; email: string | null; phone: string | null };
  organization: Clinic | null;
  role: User['role'];
}

export interface Professional {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  role: 'ADMIN' | 'PROFESSIONAL' | 'RECEPTIONIST';
  workingDays: string[];
  workingHours: { start: string; end: string };
  avatar?: string;
  active: boolean;
}

export interface Patient {
  id: string;
  name: string;
  cpf?: string;
  birthDate?: string;
  email?: string;
  phone?: string;
  gender?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreatePatientData {
  name: string;
  cpf?: string;
  birthDate?: string;
  email?: string;
  phone?: string;
  gender?: string;
  address?: string;
  notes?: string;
}

export interface Procedure {
  id: string;
  name: string;
  duration: number; // in minutes
  price: number;
  description?: string;
  active: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  procedureId: string;
  procedureName: string;
  date: string;
  time: string;
  duration: number;
  status: 'scheduled' | 'confirmed' | 'canceled' | 'done';
  notes?: string;
  price: number;
}

export interface Anamnesis {
  id: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  sections: AnamnesisSection[];
}

export interface AnamnesisSection {
  title: string;
  fields: AnamnesisField[];
}

export interface AnamnesisField {
  label: string;
  value: string;
  type: 'text' | 'textarea' | 'boolean' | 'select';
}

export interface Evolution {
  id: string;
  patientId: string;
  professionalId: string;
  professionalName: string;
  date: string;
  description: string;
  attachments?: string[];
}

export interface FinancialRecord {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId?: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'canceled';
  description: string;
}

export type AppointmentStatus = Appointment['status'];
export type FinancialStatus = FinancialRecord['status'];
