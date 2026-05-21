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
  PerinealAssessment,
  Evolution,
  FinancialRecord,
  FinancialSummary,
  TreatmentPackage,
  PlanUsage,
  SubscriptionData,
  Plan,
  PlanFeatureStatus,
  OrganizationProfile,
  UpdateOrganizationData,
} from '@/types/clinic';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

const REQUEST_TIMEOUT_MS = 30_000;

let refreshInFlight: Promise<void> | null = null;

async function tryRefreshToken(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          throw new ApiError(401, 'Sessão expirada');
        }
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestInit = {}, _isRetry = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });

    if (!res.ok) {
      const skipRefreshPaths = [
        '/auth/login',
        '/auth/refresh',
        '/auth/logout',
        '/auth/select-organization',
      ];
      if (res.status === 401 && !_isRetry && !skipRefreshPaths.includes(path)) {
        try {
          await tryRefreshToken();
        } catch {
          window.dispatchEvent(new CustomEvent('auth:logout'));
          throw new ApiError(401, 'Sessão expirada');
        }
        return request<T>(path, options, true);
      }

      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.message || 'Erro na requisição');
    }

    if (res.status === 204) {
      return undefined as T;
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

  selectOrganization: (preAuthToken: string, organizationId: string) =>
    api.post<SelectOrgResponse>('/auth/select-organization', { preAuthToken, organizationId }),

  logout: () => api.post<{ ok: true }>('/auth/logout', {}),

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
  list: (params?: { search?: string }) =>
    api.get<Professional[]>(`/professionals?${queryString(params)}`),
  getById: (id: string) => api.get<Professional>(`/professionals/${id}`),
  update: (id: string, data: { role?: string; active?: boolean; specialty?: string; professionalRegistration?: string }) =>
    api.patch<Professional>(`/professionals/${id}`, data),
  addToOrg: (_orgId: string, data: { personId: string; role: string }) =>
    api.post<unknown>('/organizations/users', data),
  removeFromOrg: (_orgId: string, userId: string) =>
    api.delete<void>(`/organizations/users/${userId}`),
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

export const perinealAssessmentsApi = {
  list: (patientId: string) =>
    api.get<PerinealAssessment[]>(`/perineal-assessments?patientId=${patientId}`),
  getById: (id: string) => api.get<PerinealAssessment>(`/perineal-assessments/${id}`),
  create: (data: { patientId: string; data: Record<string, unknown> }) =>
    api.post<PerinealAssessment>('/perineal-assessments', data),
  update: (id: string, data: { data: Record<string, unknown> }) =>
    api.patch<PerinealAssessment>(`/perineal-assessments/${id}`, data),
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
    downPayment?: number;
    downPaymentDueDate?: string;
    customInstallments?: Array<{ amount: number; dueDate: string; paymentMethod?: string }>;
  }) => api.post<TreatmentPackage>('/treatment-packages', data),
  update: (id: string, data: { name?: string; notes?: string; status?: string }) =>
    api.patch<TreatmentPackage>(`/treatment-packages/${id}`, data),
  remove: (id: string) => api.delete<void>(`/treatment-packages/${id}`),
};

type RawFinancialRecord = Omit<FinancialRecord, 'installment'> & {
  installment?: number;
  installmentTotal?: number;
};

function normalizeFinancialRecord(raw: RawFinancialRecord): FinancialRecord {
  const { installment, installmentTotal, ...rest } = raw;
  return {
    ...rest,
    ...(installment != null && installmentTotal != null
      ? { installment: { current: installment, total: installmentTotal } }
      : {}),
  };
}

function normalizeFinancialRecords(raw: RawFinancialRecord[]): FinancialRecord[] {
  return raw.map(normalizeFinancialRecord);
}

export const financialApi = {
  list: async (params: ({ month: number; year: number } | { startDate: string; endDate: string }) & { page?: number; limit?: number }) => {
    const raw = await api.get<{ data: RawFinancialRecord[]; meta: PaginatedResponse<unknown>['meta'] }>(`/financial?${queryString(params)}`);
    return { data: normalizeFinancialRecords(raw.data), meta: raw.meta };
  },
  listByPatient: async (patientId: string) =>
    normalizeFinancialRecords(await api.get<RawFinancialRecord[]>(`/financial/patient/${patientId}`)),
  summary: (params: { month: number; year: number }) =>
    api.get<FinancialSummary>(`/financial/summary?${queryString(params)}`),
  getById: async (id: string) =>
    normalizeFinancialRecord(await api.get<RawFinancialRecord>(`/financial/${id}`)),
  create: async (data: { patientId?: string; amount: number; type: string; description?: string; paymentMethod?: string; appointmentId?: string; installments?: number; dueDate?: string }) => {
    const result = await api.post<RawFinancialRecord | RawFinancialRecord[]>('/financial', data);
    return Array.isArray(result) ? normalizeFinancialRecords(result) : normalizeFinancialRecord(result);
  },
  update: async (id: string, data: Record<string, unknown>) =>
    normalizeFinancialRecord(await api.patch<RawFinancialRecord>(`/financial/${id}`, data)),
  remove: (id: string) => api.delete<void>(`/financial/${id}`),
};

export const organizationApi = {
  getPlanUsage: () => api.get<PlanUsage>('/organizations/me/plan'),
  getProfile: () => api.get<OrganizationProfile>('/organizations/me'),
  update: (data: UpdateOrganizationData) => api.patch<OrganizationProfile>('/organizations/me', data),
};

export const subscriptionApi = {
  getStatus: () => api.get<PlanFeatureStatus>('/subscription/status'),
  getCurrent: () => api.get<SubscriptionData>('/subscription'),
  getPlans: () => api.get<Plan[]>('/subscription/plans'),
  changePlan: (planId: string) => api.patch<{ ok: boolean; planId: string; planName: string }>('/subscription/plan', { planId }),
  cancel: () => api.post<{ ok: boolean; endDate: string }>('/subscription/cancel', {}),
};
