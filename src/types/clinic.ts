export interface User {
  id: string;
  name: string;
  email: string;
  cpf: string;
  role: 'admin' | 'professional' | 'receptionist';
  avatar?: string;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  logo?: string;
}

export interface Professional {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  role: 'admin' | 'professional' | 'receptionist';
  workingDays: string[];
  workingHours: { start: string; end: string };
  avatar?: string;
  active: boolean;
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  gender: 'male' | 'female' | 'other';
  address: string;
  notes?: string;
  createdAt: string;
  avatar?: string;
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
