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
  TreatmentPackage,
  PlanUsage,
} from '@/types/clinic';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

const TOKEN_KEY = 'careflow_token';
const REFRESH_TOKEN_KEY = 'careflow_refresh_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

const REQUEST_TIMEOUT_MS = 30_000;

// Refresh token queue to avoid multiple simultaneous refreshes
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  refreshQueue = [];
}

async function tryRefreshToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new ApiError(401, 'Sessão expirada');
  }

  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      throw new ApiError(401, 'Sessão expirada');
    }

    const data = await res.json();
    setToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    processQueue(null, data.accessToken);
    return data.accessToken;
  } catch (err) {
    processQueue(err, null);
    removeToken();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    throw err;
  } finally {
    isRefreshing = false;
  }
}

async function request<T>(path: string, options: RequestInit = {}, _isRetry = false): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/api${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      // Try refresh on 401, but not for login/refresh endpoints or retries
      const skipRefreshPaths = ['/auth/login', '/auth/refresh', '/auth/select-organization'];
      if (res.status === 401 && !_isRetry && !skipRefreshPaths.includes(path)) {
        const newToken = await tryRefreshToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        return request<T>(path, options, true);
      }

      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.message || 'Erro na requisição');
    }

    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, 'A requisição excedeu o tempo limite. Tente novamente.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
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
  create: (data: { patientId: string; professionalId: string; procedureId: string; startAt: string; notes?: string; treatmentPackageId?: string }) =>
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

export const treatmentPackagesApi = {
  list: (params?: { patientId?: string; status?: string }) =>
    api.get<TreatmentPackage[]>(`/treatment-packages?${queryString(params)}`),
  getById: (id: string) => api.get<TreatmentPackage>(`/treatment-packages/${id}`),
  create: (data: {
    name: string;
    patientId: string;
    procedureIds: string[];
    totalSessions: number;
    totalPrice: number;
    notes?: string;
    paymentMethod?: string;
    installments?: number;
    dueDate?: string;
  }) => api.post<TreatmentPackage>('/treatment-packages', data),
  update: (id: string, data: { name?: string; notes?: string; status?: string }) =>
    api.patch<TreatmentPackage>(`/treatment-packages/${id}`, data),
  remove: (id: string) => api.delete<void>(`/treatment-packages/${id}`),
};

export const financialApi = {
  list: (params: { month: number; year: number } | { startDate: string; endDate: string }) =>
    api.get<FinancialRecord[]>(`/financial?${queryString(params)}`),
  listByPatient: (patientId: string) =>
    api.get<FinancialRecord[]>(`/financial/patient/${patientId}`),
  summary: (params: { month: number; year: number }) =>
    api.get<FinancialSummary>(`/financial/summary?${queryString(params)}`),
  getById: (id: string) => api.get<FinancialRecord>(`/financial/${id}`),
  create: (data: { patientId: string; amount: number; type: string; description?: string; paymentMethod?: string; appointmentId?: string; installments?: number; dueDate?: string }) =>
    api.post<FinancialRecord | FinancialRecord[]>('/financial', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<FinancialRecord>(`/financial/${id}`, data),
  remove: (id: string) => api.delete<void>(`/financial/${id}`),
};

export const organizationApi = {
  getPlanUsage: () => api.get<PlanUsage>('/organizations/me/plan'),
};
