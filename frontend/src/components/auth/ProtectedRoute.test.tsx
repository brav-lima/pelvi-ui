import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/contexts/SubscriptionContext', () => ({ useSubscription: vi.fn(), useFeature: vi.fn() }));

import { useAuth } from '@/contexts/AuthContext';
import { useFeature } from '@/contexts/SubscriptionContext';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard, useHasRole } from './RoleGuard';
import { FeatureGate } from './FeatureGate';

function userWith(role: 'ADMIN' | 'PROFESSIONAL' | 'RECEPTIONIST') {
  return { id: '1', name: 'Test', email: 'a@b.com', cpf: '00000000000', role } as any;
}

function renderInRouter(ui: React.ReactNode, initialPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/protected" element={ui} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── ProtectedRoute ────────────────────────────────────────────────────────────

describe('ProtectedRoute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders children when user role is allowed', () => {
    vi.mocked(useAuth).mockReturnValue({ user: userWith('ADMIN') } as any);
    renderInRouter(
      <ProtectedRoute roles={['ADMIN']}>
        <div>Conteúdo secreto</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Conteúdo secreto')).toBeInTheDocument();
  });

  it('redirects to /dashboard when user role is not allowed', () => {
    vi.mocked(useAuth).mockReturnValue({ user: userWith('RECEPTIONIST') } as any);
    renderInRouter(
      <ProtectedRoute roles={['ADMIN']}>
        <div>Conteúdo secreto</div>
      </ProtectedRoute>,
    );
    expect(screen.queryByText('Conteúdo secreto')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders children when user is null (auth still loading)', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);
    renderInRouter(
      <ProtectedRoute roles={['ADMIN']}>
        <div>Carregando...</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('renders children when user has one of several allowed roles', () => {
    vi.mocked(useAuth).mockReturnValue({ user: userWith('PROFESSIONAL') } as any);
    renderInRouter(
      <ProtectedRoute roles={['ADMIN', 'PROFESSIONAL']}>
        <div>Permitido</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Permitido')).toBeInTheDocument();
  });
});

// ── RoleGuard ─────────────────────────────────────────────────────────────────

describe('RoleGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders children when user role matches', () => {
    vi.mocked(useAuth).mockReturnValue({ user: userWith('ADMIN') } as any);
    render(
      <MemoryRouter>
        <RoleGuard roles={['ADMIN']}>
          <button>Deletar</button>
        </RoleGuard>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Deletar' })).toBeInTheDocument();
  });

  it('renders fallback when user role does not match', () => {
    vi.mocked(useAuth).mockReturnValue({ user: userWith('RECEPTIONIST') } as any);
    render(
      <MemoryRouter>
        <RoleGuard roles={['ADMIN']} fallback={<span>Sem permissão</span>}>
          <button>Deletar</button>
        </RoleGuard>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Deletar' })).not.toBeInTheDocument();
    expect(screen.getByText('Sem permissão')).toBeInTheDocument();
  });

  it('renders nothing (no fallback) when role does not match and fallback is omitted', () => {
    vi.mocked(useAuth).mockReturnValue({ user: userWith('PROFESSIONAL') } as any);
    const { container } = render(
      <MemoryRouter>
        <RoleGuard roles={['ADMIN']}>
          <span>Admin only</span>
        </RoleGuard>
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when user is null', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);
    const { container } = render(
      <MemoryRouter>
        <RoleGuard roles={['ADMIN']}>
          <span>Admin only</span>
        </RoleGuard>
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

// ── useHasRole ────────────────────────────────────────────────────────────────

describe('useHasRole', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when user has the required role', () => {
    vi.mocked(useAuth).mockReturnValue({ user: userWith('ADMIN') } as any);
    const { result } = renderHook(() => useHasRole('ADMIN'), {
      wrapper: MemoryRouter,
    });
    expect(result.current).toBe(true);
  });

  it('returns false when user does not have the required role', () => {
    vi.mocked(useAuth).mockReturnValue({ user: userWith('RECEPTIONIST') } as any);
    const { result } = renderHook(() => useHasRole('ADMIN'), {
      wrapper: MemoryRouter,
    });
    expect(result.current).toBe(false);
  });

  it('returns true when user matches any of the given roles', () => {
    vi.mocked(useAuth).mockReturnValue({ user: userWith('PROFESSIONAL') } as any);
    const { result } = renderHook(() => useHasRole('ADMIN', 'PROFESSIONAL'), {
      wrapper: MemoryRouter,
    });
    expect(result.current).toBe(true);
  });

  it('returns false when user is null', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);
    const { result } = renderHook(() => useHasRole('ADMIN'), {
      wrapper: MemoryRouter,
    });
    expect(result.current).toBe(false);
  });
});

// ── FeatureGate ───────────────────────────────────────────────────────────────

describe('FeatureGate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders children when feature is available', () => {
    vi.mocked(useFeature).mockReturnValue(true);
    render(
      <MemoryRouter>
        <FeatureGate feature="FINANCIAL_BASIC">
          <span>Financeiro</span>
        </FeatureGate>
      </MemoryRouter>,
    );
    expect(screen.getByText('Financeiro')).toBeInTheDocument();
  });

  it('renders fallback when feature is not available', () => {
    vi.mocked(useFeature).mockReturnValue(false);
    render(
      <MemoryRouter>
        <FeatureGate feature="FINANCIAL_BASIC" fallback={<span>Plano não inclui financeiro</span>}>
          <span>Financeiro</span>
        </FeatureGate>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Financeiro')).not.toBeInTheDocument();
    expect(screen.getByText('Plano não inclui financeiro')).toBeInTheDocument();
  });

  it('renders nothing when feature is unavailable and no fallback given', () => {
    vi.mocked(useFeature).mockReturnValue(false);
    const { container } = render(
      <MemoryRouter>
        <FeatureGate feature="MULTI_PROFESSIONAL">
          <span>Conteúdo premium</span>
        </FeatureGate>
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders children while feature status is loading (fail-open)', () => {
    // useFeature returns true while loading (defined in SubscriptionContext)
    vi.mocked(useFeature).mockReturnValue(true);
    render(
      <MemoryRouter>
        <FeatureGate feature="AGENDA">
          <span>Agenda</span>
        </FeatureGate>
      </MemoryRouter>,
    );
    expect(screen.getByText('Agenda')).toBeInTheDocument();
  });
});
