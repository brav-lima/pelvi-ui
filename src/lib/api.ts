import type {
  LoginResponse,
  SelectOrgResponse,
  ProfileResponse,
  Patient,
  PaginatedResponse,
  CreatePatientData,
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
