import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  financialApi: {
    list: vi.fn(),
    summary: vi.fn(),
  },
}));

// Render Sheet inline to avoid jsdom portal issues
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

// Render Select as a native <select> to allow fireEvent.change in tests
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

import { financialApi } from '@/lib/api';
import { LivroCaixaSheet } from '@/components/financial/LivroCaixaSheet';
import { formatCurrency } from '@/lib/formatters';

// ── Mock data ──────────────────────────────────────────────────────────────────

const mockSummary = {
  month: 2,
  year: 2026,
  totalReceived: 5000,
  totalPending: 1200,
  totalExpenses: 800,
  balance: 4200,
};

// Pending INCOME with patient link
const pendingIncomeWithPatient = {
  id: 'rec-1',
  type: 'INCOME',
  status: 'PENDING',
  amount: 500,
  description: 'Consulta',
  dueDate: '2026-02-25T12:00:00.000Z', // noon UTC avoids timezone boundary issues
  patientId: 'p1',
  patient: { id: 'p1', name: 'João Silva' },
  createdAt: '2026-02-01T12:00:00.000Z',
};

// Pending INCOME without patient (uses description)
const pendingIncomeNoPatient = {
  id: 'rec-2',
  type: 'INCOME',
  status: 'PENDING',
  amount: 700,
  description: 'Plano de saúde',
  dueDate: null,
  patientId: null,
  patient: null,
  createdAt: '2026-02-05T12:00:00.000Z',
};

// PAID INCOME — must never appear in A Receber
const paidIncome = {
  id: 'rec-3',
  type: 'INCOME',
  status: 'PAID',
  amount: 5000,
  description: 'Pago',
  dueDate: null,
  patientId: 'p2',
  patient: { id: 'p2', name: 'Maria Lima' },
  createdAt: '2026-02-10T12:00:00.000Z',
};

// Pending EXPENSE
const pendingExpense = {
  id: 'exp-1',
  type: 'EXPENSE',
  status: 'PENDING',
  amount: 300,
  description: 'Aluguel sala',
  dueDate: '2026-02-20T12:00:00.000Z',
  patientId: null,
  patient: null,
  createdAt: '2026-02-01T12:00:00.000Z',
};

// PAID EXPENSE — must never appear in A Pagar
const paidExpense = {
  id: 'exp-2',
  type: 'EXPENSE',
  status: 'PAID',
  amount: 800,
  description: 'Material',
  dueDate: null,
  patientId: null,
  patient: null,
  createdAt: '2026-02-05T12:00:00.000Z',
};

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

interface RenderOptions {
  open?: boolean;
  initialMonth?: number;
  initialYear?: number;
}

function renderSheet({ open = true, initialMonth = 2, initialYear = 2026 }: RenderOptions = {}) {
  return render(
    <LivroCaixaSheet
      open={open}
      onOpenChange={vi.fn()}
      initialMonth={initialMonth}
      initialYear={initialYear}
    />,
    { wrapper: makeWrapper() },
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LivroCaixaSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(financialApi.list).mockResolvedValue([]);
    vi.mocked(financialApi.summary).mockResolvedValue(mockSummary as any);
  });

  // ── Visibilidade ─────────────────────────────────────────────────────────────

  it('não renderiza conteúdo quando fechado', () => {
    renderSheet({ open: false });
    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
  });

  it('renderiza o título quando aberto', () => {
    renderSheet();
    expect(screen.getByRole('heading', { name: 'Livro Caixa' })).toBeInTheDocument();
  });

  // ── Seletores de data ────────────────────────────────────────────────────────

  it('exibe os seletores de mês e ano com os valores iniciais', () => {
    renderSheet({ initialMonth: 3, initialYear: 2025 });
    const [monthSelect, yearSelect] = screen.getAllByRole('combobox');
    expect(monthSelect).toHaveValue('3');
    expect(yearSelect).toHaveValue('2025');
  });

  // ── Saldo ────────────────────────────────────────────────────────────────────

  describe('saldo', () => {
    it('exibe saldo, receitas recebidas e despesas pagas', async () => {
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText(`R$ ${formatCurrency(mockSummary.balance)}`)).toBeInTheDocument();
        expect(screen.getByText(`R$ ${formatCurrency(mockSummary.totalReceived)}`)).toBeInTheDocument();
        expect(screen.getByText(`R$ ${formatCurrency(mockSummary.totalExpenses)}`)).toBeInTheDocument();
      });
    });

    it('aplica cor verde (emerald) para saldo positivo', async () => {
      renderSheet();
      await waitFor(() => {
        const el = screen.getByText(`R$ ${formatCurrency(mockSummary.balance)}`);
        expect(el.className).toContain('emerald');
      });
    });

    it('aplica cor vermelha (rose) para saldo negativo', async () => {
      vi.mocked(financialApi.summary).mockResolvedValue({ ...mockSummary, balance: -200 } as any);
      renderSheet();
      await waitFor(() => {
        const el = screen.getByText(`R$ ${formatCurrency(-200)}`);
        expect(el.className).toContain('rose');
      });
    });
  });

  // ── A Receber ────────────────────────────────────────────────────────────────

  describe('A Receber', () => {
    it('exibe registro de receita pendente com nome do paciente como link', async () => {
      vi.mocked(financialApi.list).mockResolvedValue([pendingIncomeWithPatient] as any);
      renderSheet();
      await waitFor(() => {
        const link = screen.getByRole('link', { name: 'João Silva' });
        expect(link).toHaveAttribute('href', '/patients/p1');
      });
    });

    it('exibe descrição quando receita pendente não tem paciente vinculado', async () => {
      vi.mocked(financialApi.list).mockResolvedValue([pendingIncomeNoPatient] as any);
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText('Plano de saúde')).toBeInTheDocument();
      });
    });

    it('exibe a data de vencimento quando presente', async () => {
      vi.mocked(financialApi.list).mockResolvedValue([pendingIncomeWithPatient] as any);
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText(/Vence 25\/02\/2026/)).toBeInTheDocument();
      });
    });

    it('exibe o total das receitas pendentes na seção', async () => {
      vi.mocked(financialApi.list).mockResolvedValue([
        pendingIncomeWithPatient,
        pendingIncomeNoPatient,
      ] as any);
      renderSheet();
      const expectedTotal = pendingIncomeWithPatient.amount + pendingIncomeNoPatient.amount; // 1200
      await waitFor(() => {
        const els = screen.getAllByText(`R$ ${formatCurrency(expectedTotal)}`);
        expect(els.length).toBeGreaterThan(0);
      });
    });

    it('não exibe registros de receita já pagos', async () => {
      vi.mocked(financialApi.list).mockResolvedValue([pendingIncomeWithPatient, paidIncome] as any);
      renderSheet();
      // Aguarda o registro pendente aparecer (confirmando que os dados carregaram)
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      // Receita paga não deve aparecer
      expect(screen.queryByText('Maria Lima')).not.toBeInTheDocument();
    });

    it('exibe estado vazio quando não há receitas pendentes', async () => {
      // paidIncome is PAID, pendingExpense gives a signal that data loaded (A Pagar section)
      vi.mocked(financialApi.list).mockResolvedValue([paidIncome, pendingExpense] as any);
      renderSheet();
      // Aguarda A Pagar ter dados (confirmando que os dados carregaram)
      await waitFor(() => {
        expect(screen.getByText('Aluguel sala')).toBeInTheDocument();
      });
      expect(screen.getByText('Nenhum recebimento pendente')).toBeInTheDocument();
    });
  });

  // ── A Pagar ──────────────────────────────────────────────────────────────────

  describe('A Pagar', () => {
    it('exibe registro de despesa pendente com descrição', async () => {
      vi.mocked(financialApi.list).mockResolvedValue([pendingExpense] as any);
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText('Aluguel sala')).toBeInTheDocument();
        // Amount appears both in the section total and in the row
        const amountEls = screen.getAllByText(`R$ ${formatCurrency(pendingExpense.amount)}`);
        expect(amountEls.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('exibe a data de vencimento da despesa quando presente', async () => {
      vi.mocked(financialApi.list).mockResolvedValue([pendingExpense] as any);
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText(/Vence 20\/02\/2026/)).toBeInTheDocument();
      });
    });

    it('exibe o total das despesas pendentes na seção', async () => {
      vi.mocked(financialApi.list).mockResolvedValue([pendingExpense] as any);
      renderSheet();
      await waitFor(() => {
        const els = screen.getAllByText(`R$ ${formatCurrency(pendingExpense.amount)}`);
        expect(els.length).toBeGreaterThan(0);
      });
    });

    it('não exibe registros de despesa já pagos', async () => {
      vi.mocked(financialApi.list).mockResolvedValue([pendingExpense, paidExpense] as any);
      renderSheet();
      // Aguarda o registro pendente aparecer (confirmando que os dados carregaram)
      await waitFor(() => {
        expect(screen.getByText('Aluguel sala')).toBeInTheDocument();
      });
      // Despesa paga não deve aparecer
      expect(screen.queryByText('Material')).not.toBeInTheDocument();
    });

    it('exibe estado vazio quando não há despesas pendentes', async () => {
      // pendingIncomeWithPatient gives a signal that data loaded (A Receber section)
      vi.mocked(financialApi.list).mockResolvedValue([pendingIncomeWithPatient, paidExpense] as any);
      renderSheet();
      // Aguarda A Receber ter dados (confirmando que os dados carregaram)
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      expect(screen.getByText('Nenhum pagamento pendente')).toBeInTheDocument();
    });
  });

  // ── Queries ──────────────────────────────────────────────────────────────────

  describe('queries à API', () => {
    it('não chama a API quando o sheet está fechado', () => {
      renderSheet({ open: false });
      expect(financialApi.list).not.toHaveBeenCalled();
      expect(financialApi.summary).not.toHaveBeenCalled();
    });

    it('chama a API com o mês e ano iniciais ao abrir', async () => {
      renderSheet({ initialMonth: 5, initialYear: 2025 });
      await waitFor(() => {
        expect(financialApi.list).toHaveBeenCalledWith({ month: 5, year: 2025 });
        expect(financialApi.summary).toHaveBeenCalledWith({ month: 5, year: 2025 });
      });
    });

    it('recarrega dados ao alterar o mês', async () => {
      renderSheet({ initialMonth: 2, initialYear: 2026 });
      await waitFor(() => {
        expect(financialApi.list).toHaveBeenCalledWith({ month: 2, year: 2026 });
      });

      const [monthSelect] = screen.getAllByRole('combobox');
      fireEvent.change(monthSelect, { target: { value: '6' } });

      await waitFor(() => {
        expect(financialApi.list).toHaveBeenCalledWith({ month: 6, year: 2026 });
        expect(financialApi.summary).toHaveBeenCalledWith({ month: 6, year: 2026 });
      });
    });

    it('recarrega dados ao alterar o ano', async () => {
      renderSheet({ initialMonth: 2, initialYear: 2026 });
      await waitFor(() => {
        expect(financialApi.list).toHaveBeenCalledWith({ month: 2, year: 2026 });
      });

      const [, yearSelect] = screen.getAllByRole('combobox');
      fireEvent.change(yearSelect, { target: { value: '2025' } });

      await waitFor(() => {
        expect(financialApi.list).toHaveBeenCalledWith({ month: 2, year: 2025 });
        expect(financialApi.summary).toHaveBeenCalledWith({ month: 2, year: 2025 });
      });
    });
  });
});
