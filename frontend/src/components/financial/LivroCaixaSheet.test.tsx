import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  financialApi: { list: vi.fn() },
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: {
    children: React.ReactNode; value: string; onValueChange: (v: string) => void;
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

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { financialApi } from '@/lib/api';
import { LivroCaixaSheet } from '@/components/financial/LivroCaixaSheet';
import { formatCurrency } from '@/lib/formatters';

function pagedResponse(data: unknown[]) {
  return { data, meta: { total: data.length, page: 1, limit: 1000, totalPages: 1 } } as any;
}

// ── Mock data ──────────────────────────────────────────────────────────────────

// Feb 10 — paid income with patient
const paidIncomePatient = {
  id: 'r1', type: 'INCOME', status: 'PAID', amount: 500,
  description: 'Consulta', dueDate: '2026-02-10T12:00:00.000Z',
  patientId: 'p1', patient: { id: 'p1', name: 'João Silva' },
  createdAt: '2026-02-01T12:00:00.000Z',
};

// Feb 15 — paid expense (no patient)
const paidExpense = {
  id: 'r2', type: 'EXPENSE', status: 'PAID', amount: 300,
  description: 'Aluguel sala', dueDate: '2026-02-15T12:00:00.000Z',
  patientId: null, patient: null,
  createdAt: '2026-02-01T12:00:00.000Z',
};

// Feb 20 — pending income (no patient)
const pendingIncome = {
  id: 'r3', type: 'INCOME', status: 'PENDING', amount: 700,
  description: 'Plano de saúde', dueDate: '2026-02-20T12:00:00.000Z',
  patientId: null, patient: null,
  createdAt: '2026-02-05T12:00:00.000Z',
};

// Mar 5 — paid income (second month, tests opening balance carry-over)
const paidIncomeMar = {
  id: 'r4', type: 'INCOME', status: 'PAID', amount: 800,
  description: 'Sessão', dueDate: '2026-03-05T12:00:00.000Z',
  patientId: null, patient: null,
  createdAt: '2026-03-01T12:00:00.000Z',
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

function renderSheet(props: Partial<{ open: boolean; initialYear: number }> = {}) {
  const defaults = { open: true, initialYear: 2026, onOpenChange: vi.fn() };
  return render(<LivroCaixaSheet {...defaults} {...props} />, { wrapper: makeWrapper() });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LivroCaixaSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([]));
  });

  // ── Visibilidade ─────────────────────────────────────────────────────────────

  it('não renderiza conteúdo quando fechado', () => {
    renderSheet({ open: false });
    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
  });

  it('renderiza o título quando aberto', () => {
    renderSheet();
    expect(screen.getByRole('heading', { name: /Livro Caixa/i })).toBeInTheDocument();
  });

  it('renderiza o seletor de ano com o valor inicial', () => {
    renderSheet({ initialYear: 2025 });
    expect(screen.getByRole('combobox')).toHaveValue('2025');
  });

  it('exibe estado vazio quando não há registros no ano', async () => {
    renderSheet({ initialYear: 2025 });
    await waitFor(() => {
      expect(screen.getByText('Nenhum lançamento em 2025')).toBeInTheDocument();
    });
  });

  // ── Queries à API ────────────────────────────────────────────────────────────

  describe('queries à API', () => {
    it('não chama a API quando o sheet está fechado', () => {
      renderSheet({ open: false });
      expect(financialApi.list).not.toHaveBeenCalled();
    });

    it('chama a API com startDate/endDate do ano completo', async () => {
      renderSheet({ initialYear: 2025 });
      await waitFor(() => {
        expect(financialApi.list).toHaveBeenCalledWith({
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          limit: 1000,
        });
      });
    });

    it('recarrega dados ao alterar o ano', async () => {
      renderSheet({ initialYear: 2026 });
      await waitFor(() => {
        expect(financialApi.list).toHaveBeenCalledWith({
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          limit: 1000,
        });
      });

      fireEvent.change(screen.getByRole('combobox'), { target: { value: '2025' } });

      await waitFor(() => {
        expect(financialApi.list).toHaveBeenCalledWith({
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          limit: 1000,
        });
      });
    });
  });

  // ── Estrutura do livro caixa ──────────────────────────────────────────────

  describe('agrupamento por mês e dia', () => {
    it('exibe cabeçalho do mês com nome e ano', async () => {
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidIncomePatient]));
      renderSheet();
      // The label text is 'Fevereiro 2026'; uppercase is applied via CSS class
      await waitFor(() => {
        expect(screen.getByText('Fevereiro 2026')).toBeInTheDocument();
      });
    });

    it('exibe separador de dia com a data formatada', async () => {
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidIncomePatient]));
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText('10/02')).toBeInTheDocument();
      });
    });

    it('agrupa registros de meses diferentes em seções separadas', async () => {
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidIncomePatient, paidIncomeMar]));
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText('Fevereiro 2026')).toBeInTheDocument();
        expect(screen.getByText('Março 2026')).toBeInTheDocument();
      });
    });
  });

  // ── Exibição de lançamentos ───────────────────────────────────────────────

  describe('lançamentos individuais', () => {
    it('exibe nome do paciente como link para receita com paciente vinculado', async () => {
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidIncomePatient]));
      renderSheet();
      await waitFor(() => {
        const link = screen.getByRole('link', { name: 'João Silva' });
        expect(link).toHaveAttribute('href', '/patients/p1');
      });
    });

    it('exibe descrição quando não há paciente vinculado', async () => {
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidExpense]));
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText('Aluguel sala')).toBeInTheDocument();
      });
    });

    it('exibe valor positivo para receita e negativo para despesa', async () => {
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidIncomePatient, paidExpense]));
      renderSheet();
      // The income amount appears both in the entry row and in the year totals bar
      await waitFor(() => {
        expect(screen.getAllByText(`+R$ ${formatCurrency(paidIncomePatient.amount)}`).length)
          .toBeGreaterThan(0);
        expect(screen.getAllByText(`−R$ ${formatCurrency(paidExpense.amount)}`).length)
          .toBeGreaterThan(0);
      });
    });

    it('exibe badge "pendente" para registros com status PENDING', async () => {
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([pendingIncome]));
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText('pendente')).toBeInTheDocument();
      });
    });
  });

  // ── Saldo acumulado ───────────────────────────────────────────────────────

  describe('saldo acumulado (running balance)', () => {
    it('calcula e exibe o saldo após cada lançamento pago', async () => {
      // paidIncomePatient (500) → balance 500
      // paidExpense (300) → balance 200
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidIncomePatient, paidExpense]));
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText(`R$ ${formatCurrency(500)}`)).toBeInTheDocument(); // after income
        expect(screen.getByText(`R$ ${formatCurrency(200)}`)).toBeInTheDocument(); // after expense
      });
    });

    it('exibe "—" no saldo para lançamentos pendentes', async () => {
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([pendingIncome]));
      renderSheet();
      await waitFor(() => {
        // The "—" appears as the balance for a pending entry
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBeGreaterThan(0);
      });
    });

    it('saldo anterior do segundo mês reflete os pagamentos do primeiro', async () => {
      // Feb: +500 (paid) -300 (paid) → closing = 200
      // Mar opening = 200, +800 (paid) → closing = 1000
      vi.mocked(financialApi.list).mockResolvedValue(
        pagedResponse([paidIncomePatient, paidExpense, paidIncomeMar]),
      );
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText('Março 2026')).toBeInTheDocument();
      });
      // Feb closing = 200 appears in the footer; Mar closing = 1000
      expect(screen.getAllByText(`R$ ${formatCurrency(200)}`).length).toBeGreaterThan(0);
      expect(screen.getAllByText(`R$ ${formatCurrency(1000)}`).length).toBeGreaterThan(0);
    });
  });

  // ── Rodapé do mês ────────────────────────────────────────────────────────

  describe('rodapé do mês', () => {
    it('exibe totais de entradas e saídas pagas', async () => {
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidIncomePatient, paidExpense]));
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText(`Entradas: +R$ ${formatCurrency(500)}`)).toBeInTheDocument();
        expect(screen.getByText(`Saídas: −R$ ${formatCurrency(300)}`)).toBeInTheDocument();
      });
    });

    it('exibe linha de pendências quando há registros pendentes', async () => {
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidIncomePatient, pendingIncome]));
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText(/a receber R\$/)).toBeInTheDocument();
      });
    });

    it('não exibe linha de pendências quando todos os registros estão pagos', async () => {
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidIncomePatient, paidExpense]));
      renderSheet();
      await waitFor(() => {
        expect(screen.getByText('Fevereiro 2026')).toBeInTheDocument();
      });
      expect(screen.queryByText(/a receber/)).not.toBeInTheDocument();
      expect(screen.queryByText(/a pagar/)).not.toBeInTheDocument();
    });
  });

  // ── Totais anuais na barra de filtro ────────────────────────────────────────

  describe('totais anuais', () => {
    it('exibe resumo anual (entradas, saídas, saldo) na barra de filtro', async () => {
      vi.mocked(financialApi.list).mockResolvedValue(pagedResponse([paidIncomePatient, paidExpense]));
      renderSheet();
      await waitFor(() => {
        // +R$ 500,00 appears in both the year bar and the individual entry; at least one should exist
        expect(screen.getAllByText(`+R$ ${formatCurrency(500)}`).length).toBeGreaterThan(0);
        expect(screen.getAllByText(`−R$ ${formatCurrency(300)}`).length).toBeGreaterThan(0);
        // The year net balance is unique (only in the filter bar)
        expect(screen.getByText(`= R$ ${formatCurrency(200)}`)).toBeInTheDocument();
      });
    });
  });
});
