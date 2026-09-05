import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/api', () => ({
  patientsApi: { list: vi.fn(), update: vi.fn() },
  appointmentsApi: { list: vi.fn() },
  treatmentPackagesApi: { list: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn(), AnalyticsEvent: {} }));
// Expose the `patient` prop so tests can assert which patient the form opened for.
vi.mock('@/components/patients/PatientFormDialog', () => ({
  PatientFormDialog: ({ open, patient }: { open: boolean; patient?: { name: string } }) =>
    open ? <div data-testid="patient-form-dialog">{patient?.name ?? '__new__'}</div> : null,
}));

// Radix' DropdownMenu relies on pointer-capture APIs jsdom doesn't implement, so
// the menu never opens under fireEvent.click. Swap it for a transparent
// passthrough: trigger renders its child button, content + items stay mounted.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    disabled?: boolean;
  }) => (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

import Patients from './Patients';
import { patientsApi, appointmentsApi, treatmentPackagesApi } from '@/lib/api';

const paged = (data: any[], total = data.length) => ({
  data,
  meta: { total, page: 1, limit: 12, totalPages: 1 },
});
const patA = { id: 'a', name: 'Ana Ativa', status: 'ACTIVE', createdAt: '', updatedAt: '' };
const patI = { id: 'i', name: 'Ines Inativa', status: 'INACTIVE', createdAt: '', updatedAt: '' };

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Patients />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Patients — filtro de status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patientsApi.list).mockResolvedValue(paged([patA]) as any);
    vi.mocked(patientsApi.update).mockResolvedValue({} as any);
    vi.mocked(appointmentsApi.list).mockResolvedValue([] as any);
    vi.mocked(treatmentPackagesApi.list).mockResolvedValue([] as any);
  });

  it('ao abrir, busca apenas pacientes ativos', async () => {
    renderPage();
    await waitFor(() =>
      expect(patientsApi.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' })),
    );
  });

  it('clicar no chip "Inativos" refaz a busca com status INACTIVE', async () => {
    renderPage();
    await waitFor(() => expect(patientsApi.list).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /inativos/i }));

    await waitFor(() =>
      expect(patientsApi.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'INACTIVE' })),
    );
  });

  it('clicar no chip "Todos" refaz a busca sem filtro de status', async () => {
    renderPage();
    await waitFor(() => expect(patientsApi.list).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /^todos/i }));

    await waitFor(() => {
      const calledWithoutStatus = vi
        .mocked(patientsApi.list)
        .mock.calls.some((c) => c[0] != null && c[0].status === undefined);
      expect(calledWithoutStatus).toBe(true);
    });
  });

  it('o menu de ação da linha inativa o paciente ativo', async () => {
    renderPage();
    const rowEl = await screen.findByTestId('patient-row-a');

    fireEvent.click(within(rowEl).getByRole('button', { name: /ações/i }));
    fireEvent.click(await screen.findByText('Marcar como inativo'));

    await waitFor(() =>
      expect(patientsApi.update).toHaveBeenCalledWith('a', { status: 'INACTIVE' }),
    );
  });

  it('mostra o StatusBadge "Inativo" quando o filtro não é "Ativos"', async () => {
    vi.mocked(patientsApi.list).mockResolvedValue(paged([patI]) as any);
    renderPage();
    await waitFor(() => expect(patientsApi.list).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /inativos/i }));

    expect(await screen.findByText('Inativo')).toBeInTheDocument();
  });

  it('clicar em "Editar dados" no menu da linha abre o formulário com o paciente da linha', async () => {
    renderPage();
    const rowEl = await screen.findByTestId('patient-row-a');

    fireEvent.click(within(rowEl).getByRole('button', { name: /ações/i }));
    fireEvent.click(await screen.findByText('Editar dados'));

    const dialog = await screen.findByTestId('patient-form-dialog');
    expect(dialog).toHaveTextContent('Ana Ativa');
  });

  it('mostra a mensagem específica de vazio quando não há pacientes inativos', async () => {
    vi.mocked(patientsApi.list).mockResolvedValue(paged([]) as any);
    renderPage();
    await waitFor(() => expect(patientsApi.list).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /inativos/i }));

    expect(await screen.findByText('Nenhum paciente inativo')).toBeInTheDocument();
  });

  it('os chips de status expõem aria-pressed', async () => {
    renderPage();
    await waitFor(() => expect(patientsApi.list).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: 'Ativos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Inativos' })).toHaveAttribute('aria-pressed', 'false');
  });
});
