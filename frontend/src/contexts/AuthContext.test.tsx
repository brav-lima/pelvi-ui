import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Must be declared before the module mock so the factory can use it
vi.mock('@/lib/api', () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
    selectOrganization: vi.fn(),
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

import { authApi, ApiError } from '@/lib/api';
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
    } as any);

    render(<StatusConsumer />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Maria');
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
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
});
