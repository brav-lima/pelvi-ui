import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('@/lib/api', () => ({
  patientsApi: { getById: vi.fn(), update: vi.fn() },
  appointmentsApi: { list: vi.fn() },
  anamnesisApi: { list: vi.fn() },
  evolutionsApi: { list: vi.fn() },
  treatmentPackagesApi: { list: vi.fn() },
  financialApi: { listByPatient: vi.fn() },
  perinealAssessmentsApi: { list: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn(), AnalyticsEvent: {} }));
vi.mock('@/contexts/SubscriptionContext', () => ({ useFeature: () => true }));
vi.mock('@/components/patients/PatientFormDialog', () => ({ PatientFormDialog: () => null }));
vi.mock('@/components/appointments/AppointmentFormDialog', () => ({ AppointmentFormDialog: () => null }));
vi.mock('@/components/evolutions/EvolutionFormDialog', () => ({ EvolutionFormDialog: () => null }));
vi.mock('@/components/treatment-packages/TreatmentPackageFormDialog', () => ({ TreatmentPackageFormDialog: () => null }));

import PatientProfile from './PatientProfile';
import { patientsApi, appointmentsApi, anamnesisApi, evolutionsApi, treatmentPackagesApi, financialApi, perinealAssessmentsApi } from '@/lib/api';

const patient = (status: 'ACTIVE' | 'INACTIVE') => ({
  id: 'p1', name: 'Maria Teste', status, createdAt: '2024-01-01', updatedAt: '2024-01-01',
});

function renderProfile() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/patients/p1']}>
        <Routes>
          <Route path="/patients/:id" element={<PatientProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(appointmentsApi.list).mockResolvedValue([] as any);
  vi.mocked(anamnesisApi.list).mockResolvedValue([] as any);
  vi.mocked(evolutionsApi.list).mockResolvedValue([] as any);
  vi.mocked(treatmentPackagesApi.list).mockResolvedValue([] as any);
  vi.mocked(financialApi.listByPatient).mockResolvedValue([] as any);
  vi.mocked(perinealAssessmentsApi.list).mockResolvedValue([] as any);
  vi.mocked(patientsApi.update).mockResolvedValue({} as any);
});

describe('PatientProfile — status', () => {
  it('mostra badge "Inativo" e botão "Reativar paciente" quando inativo', async () => {
    vi.mocked(patientsApi.getById).mockResolvedValue(patient('INACTIVE') as any);
    renderProfile();

    expect(await screen.findByText('Inativo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reativar paciente/i })).toBeInTheDocument();
  });

  it('botão "Marcar como inativo" → confirmar chama patientsApi.update', async () => {
    vi.mocked(patientsApi.getById).mockResolvedValue(patient('ACTIVE') as any);
    renderProfile();

    fireEvent.click(await screen.findByRole('button', { name: /marcar como inativo/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^confirmar$/i }));

    await waitFor(() =>
      expect(patientsApi.update).toHaveBeenCalledWith('p1', { status: 'INACTIVE' }),
    );
  });
});
