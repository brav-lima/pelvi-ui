import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'ADMIN' }, clinic: { id: 'c1' } }),
}));

vi.mock('@/lib/api', () => ({
  patientsApi: { list: vi.fn() },
  evolutionsApi: { list: vi.fn(), remove: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/evolutions/EvolutionFormDialog', () => ({
  EvolutionFormDialog: () => null,
}));

import Evolutions from './Evolutions';
import { patientsApi, evolutionsApi } from '@/lib/api';
import { toast } from 'sonner';

const patient = { id: 'p1', name: 'Maria Teste', cpf: '12345678900' };

const evolution = {
  id: 'e1',
  organizationId: 'c1',
  patientId: 'p1',
  professionalId: 'prof1',
  description: 'Paciente evoluiu bem',
  evolutionDate: '2026-01-10T10:00:00.000Z',
  createdAt: '2026-01-10T10:00:00.000Z',
  updatedAt: '2026-01-10T10:00:00.000Z',
  professional: { id: 'prof1', person: { name: 'Dr. João' } },
  appointment: {
    id: 'a1',
    startAt: '2026-01-10T10:00:00.000Z',
    endAt: '2026-01-10T11:00:00.000Z',
    status: 'DONE' as const,
    procedure: { name: 'Fisioterapia' },
  },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Evolutions />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(patientsApi.list).mockResolvedValue({
    data: [patient],
    meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
  } as any);
  vi.mocked(evolutionsApi.list).mockResolvedValue([evolution] as any);
  vi.mocked(evolutionsApi.remove).mockResolvedValue(undefined as any);
});

it('renderiza a página de evoluções', () => {
  renderPage();
  expect(screen.getByText('Evoluções')).toBeInTheDocument();
});

describe('exclusão de evolução', () => {
  it('exibe a consulta vinculada via LinkedAppointmentLine (sem o bloco antigo)', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Maria Teste'));

    expect(await screen.findByText(/Fisioterapia/)).toBeInTheDocument();
    expect(screen.getByText('Concluído')).toBeInTheDocument();
  });

  it('clica na lixeira → confirma → chama evolutionsApi.remove e invalida as queries', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Maria Teste'));

    fireEvent.click(await screen.findByRole('button', { name: /excluir evolução/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^excluir$/i }));

    await waitFor(() => expect(evolutionsApi.remove).toHaveBeenCalledWith('e1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
