import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Must be declared before the module mock so the factory can use it
vi.mock('@/lib/api', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
    selectOrganization: vi.fn(),
    switchOrganization: vi.fn(),
    logout: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  },
}));

// Spy on the analytics module so we can assert `track` is (or isn't) called.
// Real analytics functions are no-ops in tests anyway (VITE_POSTHOG_KEY is never
// set), but a plain no-op can't tell us whether a call happened at all — hence the mock.
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  identifyUser: vi.fn(),
  resetUser: vi.fn(),
  AnalyticsEvent: { Login: 'login' },
}));

import { authApi, ApiError } from '@/lib/api';
import { track } from '@/lib/analytics';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

function StatusConsumer() {
  const { isAuthenticated, user, clinics } = useAuth();
  return (
    <div>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user?.name ?? 'none'}</span>
      <span data-testid="clinics">{clinics.length}</span>
    </div>
  );
}

const singleClinicResponse = {
  person: { id: 'p1', name: 'João Silva', email: 'joao@test.com', cpf: '11111111111' },
  organization: { id: 'org1', name: 'Clínica Teste' },
  role: 'ADMIN',
  organizations: [
    { id: 'ou1', role: 'ADMIN', organization: { id: 'org1', name: 'Clínica Teste' } },
    { id: 'ou2', role: 'ADMIN', organization: { id: 'org2', name: 'Clínica Extra' } },
  ],
};

const multiClinicResponse = {
  person: { id: 'p1', name: 'João Silva', email: 'joao@test.com', cpf: '11111111111' },
  organizations: [
    { organization: { id: 'org1', name: 'Clínica A' }, role: 'ADMIN' },
    { organization: { id: 'org2', name: 'Clínica B' }, role: 'PROFESSIONAL' },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<StatusConsumer />)).toThrow(
      'useAuth must be used within an AuthProvider',
    );
    spy.mockRestore();
  });
});

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockRejectedValue(new ApiError('Não autenticado', 401));
    vi.mocked(authApi.logout).mockResolvedValue({ ok: true } as any);
  });

  it('starts unauthenticated when /me fails (no cookie)', async () => {
    render(<StatusConsumer />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
      expect(screen.getByTestId('user').textContent).toBe('none');
    });
  });

  it('restores session on mount when /me returns a profile (cookie present)', async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      person: { id: 'p1', name: 'Maria', email: 'maria@test.com', cpf: '22222222222' },
      organization: { id: 'org1', name: 'Clínica X' },
      role: 'PROFESSIONAL',
      organizations: [
        { id: 'ou1', role: 'PROFESSIONAL', organization: { id: 'org1', name: 'Clínica X' } },
      ],
    } as any);

    render(<StatusConsumer />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Maria');
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
      expect(screen.getByTestId('clinics').textContent).toBe('1');
    });

    // Session restoration must never fire the `login` analytics event —
    // only interactive login()/selectClinic() should.
    expect(track).not.toHaveBeenCalledWith('login', expect.anything());
    expect(track).not.toHaveBeenCalled();
  });

  it('stays unauthenticated when /me fails', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('Unauthorized'));

    render(<StatusConsumer />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('none');
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });
  });

  describe('login()', () => {
    it('succeeds for single-clinic user: sets user and selectedClinic', async () => {
      vi.mocked(authApi.login).mockResolvedValue(singleClinicResponse as any);

      let loginFn!: ReturnType<typeof useAuth>['login'];
      function Consumer() {
        const auth = useAuth();
        loginFn = auth.login;
        return <span data-testid="user">{auth.user?.name ?? 'none'}</span>;
      }

      render(<Consumer />, { wrapper: makeWrapper() });

      let result: any;
      await act(async () => {
        result = await loginFn('11111111111', '123456');
      });

      expect(result).toEqual({ success: true, multiClinic: false });
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('João Silva');
      });

      // Confirms the mock isn't a silent no-op: interactive login DOES track.
      expect(track).toHaveBeenCalledWith('login', { role: 'ADMIN' });
    });

    it('succeeds for multi-clinic user: populates clinics list, returns multiClinic=true', async () => {
      vi.mocked(authApi.login).mockResolvedValue(multiClinicResponse as any);

      let loginFn!: ReturnType<typeof useAuth>['login'];
      function Consumer() {
        const auth = useAuth();
        loginFn = auth.login;
        return <span data-testid="clinics">{auth.clinics.length}</span>;
      }

      render(<Consumer />, { wrapper: makeWrapper() });

      let result: any;
      await act(async () => {
        result = await loginFn('11111111111', '123456');
      });

      expect(result).toEqual({ success: true, multiClinic: true });
      await waitFor(() => {
        expect(screen.getByTestId('clinics').textContent).toBe('2');
      });
    });

    it('strips CPF mask before calling the API', async () => {
      vi.mocked(authApi.login).mockResolvedValue(singleClinicResponse as any);

      let loginFn!: ReturnType<typeof useAuth>['login'];
      function Consumer() {
        const auth = useAuth();
        loginFn = auth.login;
        return null;
      }

      render(<Consumer />, { wrapper: makeWrapper() });
      await act(async () => { await loginFn('111.111.111-11', '123456'); });

      expect(authApi.login).toHaveBeenCalledWith('11111111111', '123456');
    });

    it('returns error message on API failure', async () => {
      vi.mocked(authApi.login).mockRejectedValue(new ApiError('CPF ou senha inválidos', 401));

      let loginFn!: ReturnType<typeof useAuth>['login'];
      function Consumer() {
        const auth = useAuth();
        loginFn = auth.login;
        return null;
      }

      render(<Consumer />, { wrapper: makeWrapper() });

      let result: any;
      await act(async () => {
        result = await loginFn('00000000000', 'wrong');
      });

      expect(result).toEqual({
        success: false,
        multiClinic: false,
        error: 'CPF ou senha inválidos',
      });
    });
  });

  describe('logout()', () => {
    it('clears user state and calls authApi.logout', async () => {
      vi.mocked(authApi.login).mockResolvedValue(singleClinicResponse as any);

      let auth!: ReturnType<typeof useAuth>;
      function Consumer() {
        auth = useAuth();
        return <span data-testid="user">{auth.user?.name ?? 'none'}</span>;
      }

      render(<Consumer />, { wrapper: makeWrapper() });

      await act(async () => { await auth.login('11111111111', '123456'); });
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('João Silva');
      });

      act(() => { auth.logout(); });

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('none');
      });
      expect(authApi.logout).toHaveBeenCalled();
    });
  });

  describe('switchClinic()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('switches selectedClinic and refreshes clinics on success', async () => {
      vi.mocked(authApi.login).mockResolvedValue(singleClinicResponse as any);
      vi.mocked(authApi.switchOrganization).mockResolvedValue({
        person: { id: 'p1', name: 'João Silva', email: 'joao@test.com', cpf: '11111111111' },
        organization: { id: 'org2', name: 'Clínica Extra' },
        role: 'PROFESSIONAL',
        organizations: singleClinicResponse.organizations,
      } as any);

      let auth!: ReturnType<typeof useAuth>;
      function Consumer() {
        auth = useAuth();
        return (
          <div>
            <span data-testid="clinic">{auth.selectedClinic?.name ?? 'none'}</span>
            <span data-testid="role">{auth.user?.role ?? 'none'}</span>
          </div>
        );
      }

      render(<Consumer />, { wrapper: makeWrapper() });
      await act(async () => { await auth.login('11111111111', '123456'); });
      await waitFor(() => {
        expect(screen.getByTestId('clinic').textContent).toBe('Clínica Teste');
      });

      const clearSpy = vi.spyOn(QueryClient.prototype, 'clear');

      let result: boolean | undefined;
      await act(async () => { result = await auth.switchClinic('org2'); });

      expect(result).toBe(true);
      expect(authApi.switchOrganization).toHaveBeenCalledWith('org2');
      await waitFor(() => {
        expect(screen.getByTestId('clinic').textContent).toBe('Clínica Extra');
        expect(screen.getByTestId('role').textContent).toBe('PROFESSIONAL');
      });

      // A clinic switch changes the active session identity — the query cache
      // must be cleared so stale data/feature-gating from the previous clinic
      // doesn't leak into the new one (see clearSession(), used by logout()).
      expect(clearSpy).toHaveBeenCalled();
    });

    it('returns false, keeps session intact, and does not clear the cache on failure', async () => {
      vi.mocked(authApi.login).mockResolvedValue(singleClinicResponse as any);
      vi.mocked(authApi.switchOrganization).mockRejectedValue(new ApiError('Vínculo inválido ou inativo', 401));

      let auth!: ReturnType<typeof useAuth>;
      function Consumer() {
        auth = useAuth();
        return <span data-testid="clinic">{auth.selectedClinic?.name ?? 'none'}</span>;
      }

      render(<Consumer />, { wrapper: makeWrapper() });
      await act(async () => { await auth.login('11111111111', '123456'); });
      await waitFor(() => {
        expect(screen.getByTestId('clinic').textContent).toBe('Clínica Teste');
      });

      const clearSpy = vi.spyOn(QueryClient.prototype, 'clear');

      let result: boolean | undefined;
      await act(async () => { result = await auth.switchClinic('org-missing'); });

      expect(result).toBe(false);
      expect(screen.getByTestId('clinic').textContent).toBe('Clínica Teste');
      expect(clearSpy).not.toHaveBeenCalled();
    });
  });
});
