import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePatientStatusMutation } from './use-patient-status-mutation';

vi.mock('@/lib/api', () => ({
  patientsApi: { update: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { patientsApi } from '@/lib/api';
import { toast } from 'sonner';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('usePatientStatusMutation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama patientsApi.update com o status e mostra toast de sucesso', async () => {
    vi.mocked(patientsApi.update).mockResolvedValue({} as any);
    const { result } = renderHook(() => usePatientStatusMutation('pat-1'), { wrapper });

    result.current.mutate('INACTIVE');

    await waitFor(() => expect(patientsApi.update).toHaveBeenCalledWith('pat-1', { status: 'INACTIVE' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Paciente marcado como inativo'));
  });

  it('mostra toast de erro quando a API falha', async () => {
    vi.mocked(patientsApi.update).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePatientStatusMutation('pat-1'), { wrapper });

    result.current.mutate('ACTIVE');

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao alterar status do paciente'));
  });
});
