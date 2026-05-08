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

// Auth API response types — tokens travel as httpOnly cookies, not in the body
export interface LoginResponseSingle {
  person: { id: string; cpf: string; name: string; email: string | null };
  organization: Clinic;
  role: User['role'];
}

export interface LoginResponseMulti {
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
  person: { id: string; cpf: string; name: string; email: string | null };
  organization: Clinic;
  role: User['role'];
}

export interface ProfileResponse {
  person: { id: string; cpf: string; name: string; email: string | null; phone: string | null };
  organization: Clinic | null;
  role: User['role'] | null;
}

// Backend returns OrganizationUser + Person join
export interface Professional {
  id: string;
  organizationId: string;
  personId: string;
  role: 'ADMIN' | 'PROFESSIONAL' | 'RECEPTIONIST';
  active: boolean;
  person: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    cpf: string;
  };
}

export interface Patient {
  id: string;
  name: string;
  cpf?: string;
  birthDate?: string;
  email?: string;
  phone?: string;
  gender?: string;
  addressCep?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
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
  addressCep?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  notes?: string;
}

export interface Procedure {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'CANCELED' | 'DONE';

export interface Appointment {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  procedureId: string;
  treatmentPackageId?: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  patient?: { id: string; name: string };
  professional?: { id: string; person: { name: string } };
  procedure?: { id: string; name: string; durationMinutes: number; price: number };
  treatmentPackage?: { id: string; name: string };
}

export interface Anamnesis {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  patient?: { id: string; name: string };
  professional?: { id: string; person: { name: string } };
}

export interface PerinealAssessment {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  patient?: { id: string; name: string };
  professional?: { id: string; person: { name: string } };
}

export interface Evolution {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  appointmentId?: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  patient?: { id: string; name: string };
  professional?: { id: string; person: { name: string } };
}

export type TreatmentPackageStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELED';

export interface TreatmentPackage {
  id: string;
  organizationId: string;
  patientId: string;
  name: string;
  totalSessions: number;
  usedSessions: number;
  totalPrice: number;
  status: TreatmentPackageStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  procedures?: Array<{
    id: string;
    procedureId: string;
    procedure: { id: string; name: string };
  }>;
  patient?: { id: string; name: string };
}

export interface PlanUsage {
  accessStatus: 'ACTIVE' | 'BLOCKED';
  planMaxPatients: number | null;
  planMaxUsers: number | null;
  currentPatients: number;
  currentUsers: number;
}

export type FinancialType = 'INCOME' | 'EXPENSE';
export type FinancialStatus = 'PENDING' | 'PAID';

/**
 * Installment info for a financial record.
 * `current` must be between 1 and `total` — validated at runtime, not enforced by the type.
 */
export interface InstallmentInfo {
  current: number;
  total: number;
}

export interface FinancialRecord {
  id: string;
  organizationId: string;
  patientId?: string;
  appointmentId?: string;
  amount: number;
  type: FinancialType;
  status: FinancialStatus;
  paymentMethod?: string;
  description?: string;
  dueDate?: string;
  installment?: InstallmentInfo;
  createdAt: string;
  updatedAt: string;
  patient?: { id: string; name: string };
}

export interface FinancialSummary {
  totalReceived: number;
  totalPending: number;
  totalExpenses: number;
  balance: number;
}
