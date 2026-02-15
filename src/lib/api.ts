import type {
  LoginResponse,
  SelectOrgResponse,
  ProfileResponse,
  Patient,
  PaginatedResponse,
  CreatePatientData,
  Procedure,
  Professional,
  Appointment,
  AppointmentStatus,
  Anamnesis,
  Evolution,
  FinancialRecord,
  FinancialSummary,
} from '@/types/clinic';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

const TOKEN_KEY = 'careflow_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message || 'Erro na requisição');
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export const authApi = {
  login: (cpf: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { cpf, password }),

  selectOrganization: (personId: string, organizationId: string) =>
    api.post<SelectOrgResponse>('/auth/select-organization', { personId, organizationId }),

  me: () => api.get<ProfileResponse>('/auth/me'),
  updateProfile: (data: { name?: string; email?: string; phone?: string }) =>
    api.patch<{ id: string; cpf: string; name: string; email: string | null; phone: string | null }>('/auth/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<{ message: string }>('/auth/change-password', data),
};

function queryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export const patientsApi = {
  list: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Patient>>(`/patients?${queryString(params)}`),
  getById: (id: string) => api.get<Patient>(`/patients/${id}`),
  create: (data: CreatePatientData) => api.post<Patient>('/patients', data),
  update: (id: string, data: Partial<CreatePatientData>) =>
    api.patch<Patient>(`/patients/${id}`, data),
  remove: (id: string) => api.delete<void>(`/patients/${id}`),
};

export const proceduresApi = {
  list: () => api.get<Procedure[]>('/procedures'),
  getById: (id: string) => api.get<Procedure>(`/procedures/${id}`),
  create: (data: { name: string; durationMinutes: number; price: number }) =>
    api.post<Procedure>('/procedures', data),
  update: (id: string, data: Partial<{ name: string; durationMinutes: number; price: number; active: boolean }>) =>
    api.patch<Procedure>(`/procedures/${id}`, data),
  remove: (id: string) => api.delete<void>(`/procedures/${id}`),
};

export const personsApi = {
  create: (data: { cpf: string; name: string; email: string; phone?: string; password: string }) =>
    api.post<{ id: string }>('/persons', data),
};

export const professionalsApi = {
  list: () => api.get<Professional[]>('/professionals'),
  getById: (id: string) => api.get<Professional>(`/professionals/${id}`),
  update: (id: string, data: { role?: string; active?: boolean }) =>
    api.patch<Professional>(`/professionals/${id}`, data),
  addToOrg: (orgId: string, data: { personId: string; role: string }) =>
    api.post<unknown>(`/organizations/${orgId}/users`, data),
  removeFromOrg: (orgId: string, userId: string) =>
    api.delete<void>(`/organizations/${orgId}/users/${userId}`),
};

export const appointmentsApi = {
  list: (params: { startDate: string; endDate: string; professionalId?: string }) =>
    api.get<Appointment[]>(`/appointments?${queryString(params)}`),
  getById: (id: string) => api.get<Appointment>(`/appointments/${id}`),
  create: (data: { patientId: string; professionalId: string; procedureId: string; startAt: string; notes?: string }) =>
    api.post<Appointment>('/appointments', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Appointment>(`/appointments/${id}`, data),
  updateStatus: (id: string, status: AppointmentStatus) =>
    api.patch<Appointment>(`/appointments/${id}/status`, { status }),
  remove: (id: string) => api.delete<void>(`/appointments/${id}`),
};

export const anamnesisApi = {
  list: (patientId: string) => api.get<Anamnesis[]>(`/anamneses?patientId=${patientId}`),
  getById: (id: string) => api.get<Anamnesis>(`/anamneses/${id}`),
  create: (data: { patientId: string; data: Record<string, unknown> }) =>
    api.post<Anamnesis>('/anamneses', data),
  update: (id: string, data: { data: Record<string, unknown> }) =>
    api.patch<Anamnesis>(`/anamneses/${id}`, data),
};

export const evolutionsApi = {
  list: (patientId: string) => api.get<Evolution[]>(`/evolutions?patientId=${patientId}`),
  getById: (id: string) => api.get<Evolution>(`/evolutions/${id}`),
  create: (data: { patientId: string; description: string; appointmentId?: string }) =>
    api.post<Evolution>('/evolutions', data),
};

export const financialApi = {
  list: (params: { month: number; year: number }) =>
    api.get<FinancialRecord[]>(`/financial?${queryString(params)}`),
  summary: (params: { month: number; year: number }) =>
    api.get<FinancialSummary>(`/financial/summary?${queryString(params)}`),
  getById: (id: string) => api.get<FinancialRecord>(`/financial/${id}`),
  create: (data: { patientId: string; amount: number; type: string; description?: string; paymentMethod?: string; appointmentId?: string }) =>
    api.post<FinancialRecord>('/financial', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<FinancialRecord>(`/financial/${id}`, data),
  remove: (id: string) => api.delete<void>(`/financial/${id}`),
};
