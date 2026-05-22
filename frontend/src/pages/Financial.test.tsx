import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  financialApi: {
    list: vi.fn(),
    summary: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/auth/RoleGuard', () => ({
  useHasRole: vi.fn(),
}));

vi.mock('@/components/financial/FinancialFormDialog', () => ({
  FinancialFormDialog: () => null,
}));

vi.mock('@/components/financial/LivroCaixaSheet', () => ({
  LivroCaixaSheet: () => null,
}));

vi.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: React.ReactNode }) => (
    <div><h1>{title}</h1>{action}</div>
  ),
}));

vi.mock('@/components/ui/stat-card', () => ({
  StatCard: ({ title, value }: { title: string; value: string }) => (
    <div><span>{title}</span><span>{value}</span></div>
  ),
}));

vi.mock('@/components/ui/status-badge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, title, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} title={title} disabled={disabled}>{children}</button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children, asChild }: { children: React.ReactElement; asChild?: boolean }) =>
    asChild ? children : <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-dialog-content">{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children, onClick, className }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} className={className}>{children}</button>
  ),
}));

vi.mock('lucide-react', () => ({
  TrendingUp: () => null, TrendingDown: () => null, BookOpen: () => null,
  CheckCircle: () => <span>✓</span>, Plus: () => null, Trash2: () => <span>🗑</span>,
  Loader2: () => null, ChevronRight: () => null, ChevronLeft: () => null,
  AlertCircle: () => null,
}));

import { financialApi } from '@/lib/api';
import { toast } from 'sonner';
import { useHasRole } from '@/components/auth/RoleGuard';
import Financial from './Financial';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const pendingRecord = {
  id: 'r1',
  type: 'INCOME',
  status: 'PENDING',
  amount: 350,
  description: 'Consulta',
  paymentMethod: null,
  dueDate: null,
  patientId: 'p1',
  patient: { id: 'p1', name: 'João Silva' },
  createdAt: new Date().toISOString(),
};

const paidRecord = {
  ...pendingRecord,
  id: 'r2',
  status: 'PAID',
  description: 'Consulta paga',
};

function pagedResponse(data: unknown[]) {
  return { data, meta: { total: data.length, page: 1, limit: 50, totalPages: 1 } } as any;
}

const emptySummary = { totalReceived: 0, totalPending: 0, totalExpenses: 0, balance: 0 } as any;

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

function renderFinancial() {
  return render(<Financial />, { wrapper: makeWrapper() });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Financial — dar baixa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(financialApi.summary).mockResolvedValue(emptySummary);
  });

  it('exibe o botão "Dar baixa" para registros PENDING quando o usuário é ADMIN', async () => {
    vi.mocked(useHasRole).mockReturnValue(true);
    vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([pendingRecord]));

    renderFinancial();

    await waitFor(() => {
      expect(screen.getByTitle('Dar baixa')).toBeInTheDocument();
    });
  });

  it('não exibe o botão "Dar baixa" para registros PAID', async () => {
    vi.mocked(useHasRole).mockReturnValue(true);
    vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidRecord]));

    renderFinancial();

    await waitFor(() => {
      expect(screen.queryByTitle('Dar baixa')).not.toBeInTheDocument();
    });
  });

  it('não exibe ações de admin quando usuário não é ADMIN', async () => {
    vi.mocked(useHasRole).mockReturnValue(false);
    vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([pendingRecord]));

    renderFinancial();

    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });
    expect(screen.queryByTitle('Dar baixa')).not.toBeInTheDocument();
  });

  it('chama financialApi.update com status PAID ao confirmar "dar baixa"', async () => {
    vi.mocked(useHasRole).mockReturnValue(true);
    vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([pendingRecord]));
    vi.mocked(financialApi.update).mockResolvedValue({ ...pendingRecord, status: 'PAID' } as any);

    renderFinancial();

    await waitFor(() => screen.getByTitle('Dar baixa'));

    fireEvent.click(screen.getByTitle('Dar baixa'));

    // Click "Confirmar" in the AlertDialog
    const confirmarBtn = screen.getByRole('button', { name: 'Confirmar' });
    fireEvent.click(confirmarBtn);

    await waitFor(() => {
      expect(financialApi.update).toHaveBeenCalledWith('r1', { status: 'PAID' });
    });
  });

  it('exibe toast de sucesso após confirmar pagamento', async () => {
    vi.mocked(useHasRole).mockReturnValue(true);
    vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([pendingRecord]));
    vi.mocked(financialApi.update).mockResolvedValue({ ...pendingRecord, status: 'PAID' } as any);

    renderFinancial();

    await waitFor(() => screen.getByTitle('Dar baixa'));
    fireEvent.click(screen.getByTitle('Dar baixa'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Pagamento confirmado');
    });
  });

  it('exibe toast de erro quando a API falha ao confirmar pagamento', async () => {
    vi.mocked(useHasRole).mockReturnValue(true);
    vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([pendingRecord]));
    vi.mocked(financialApi.update).mockRejectedValue(new Error('Server error'));

    renderFinancial();

    await waitFor(() => screen.getByTitle('Dar baixa'));
    fireEvent.click(screen.getByTitle('Dar baixa'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erro ao confirmar pagamento');
    });
  });
});

// ── Tests — exclusão de registro ──────────────────────────────────────────────

describe('Financial — excluir registro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(financialApi.summary).mockResolvedValue(emptySummary);
  });

  function getTrashButton() {
    return screen.getAllByRole('button').find((b) => b.textContent?.trim() === '🗑');
  }

  it('chama financialApi.remove ao confirmar exclusão', async () => {
    vi.mocked(useHasRole).mockReturnValue(true);
    vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidRecord]));
    vi.mocked(financialApi.remove).mockResolvedValue({} as any);

    renderFinancial();

    await waitFor(() => expect(getTrashButton()).toBeDefined());
    fireEvent.click(getTrashButton()!);

    // Use within to scope inside the dialog (avoids ARIA modal scoping issues)
    const dialogs = screen.getAllByTestId('alert-dialog-content');
    const deleteDialog = dialogs[dialogs.length - 1];
    fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => {
      expect(financialApi.remove).toHaveBeenCalledWith('r2');
    });
  });

  it('exibe toast de sucesso após excluir', async () => {
    vi.mocked(useHasRole).mockReturnValue(true);
    vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidRecord]));
    vi.mocked(financialApi.remove).mockResolvedValue({} as any);

    renderFinancial();

    await waitFor(() => expect(getTrashButton()).toBeDefined());
    fireEvent.click(getTrashButton()!);

    const dialogs = screen.getAllByTestId('alert-dialog-content');
    const deleteDialog = dialogs[dialogs.length - 1];
    fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Registro excluído com sucesso');
    });
  });
});
