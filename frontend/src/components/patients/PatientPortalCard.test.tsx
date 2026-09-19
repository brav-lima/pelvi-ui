import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', () => ({
  patientPortalApi: {
    getPortalStatus: vi.fn(),
    invite: vi.fn(),
    resendConsent: vi.fn(),
    updatePlan: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { patientPortalApi } from '@/lib/api';
import { toast } from 'sonner';
import { PatientPortalCard } from './PatientPortalCard';

function renderCard(props: Partial<React.ComponentProps<typeof PatientPortalCard>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PatientPortalCard patientId="pat-1" {...props} />
    </QueryClientProvider>,
  );
}

const noLink = {
  linkId: null,
  linkStatus: null,
  invitedAt: null,
  confirmedAt: null,
  features: { diarioMiccional: false, diarioEvacuatorio: false, cronometros: false },
};

describe('PatientPortalCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem vínculo e sem CPF: botão de convite desabilitado com aviso', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue(noLink as any);
    renderCard({ patientCpf: undefined });

    expect(await screen.findByRole('button', { name: /convidar para o app/i })).toBeDisabled();
    expect(screen.getByText(/cadastre o cpf/i)).toBeInTheDocument();
  });

  it('sem vínculo e com CPF: convite habilitado e chama a API ao clicar', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue(noLink as any);
    vi.mocked(patientPortalApi.invite).mockResolvedValue({ message: 'Convite enviado' });
    renderCard({ patientCpf: '12345678901' });

    const button = await screen.findByRole('button', { name: /convidar para o app/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    await waitFor(() => expect(patientPortalApi.invite).toHaveBeenCalledWith('pat-1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Convite enviado'));
  });

  it('PENDING_CONSENT: mostra a data do convite pendente', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      ...noLink,
      linkId: 'link-1',
      linkStatus: 'PENDING_CONSENT',
      invitedAt: '2026-09-10T12:00:00Z',
    } as any);
    renderCard({ patientCpf: '12345678901' });

    expect(await screen.findByText(/pendente desde 10\/09\/2026/i)).toBeInTheDocument();
  });

  it('DECLINED: mostra a data de recusa e reenvia ao clicar', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      ...noLink,
      linkId: 'link-1',
      linkStatus: 'DECLINED',
      confirmedAt: '2026-09-11T12:00:00Z',
    } as any);
    vi.mocked(patientPortalApi.resendConsent).mockResolvedValue({ message: 'Solicitação reenviada' });
    renderCard({ patientCpf: '12345678901' });

    expect(await screen.findByText(/recusado em 11\/09\/2026/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reenviar solicitação/i }));

    await waitFor(() => expect(patientPortalApi.resendConsent).toHaveBeenCalledWith('link-1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Solicitação reenviada'));
  });

  it('ACTIVE: mostra a data do vínculo e os 3 switches do plano; alterna um deles', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      linkId: 'link-1',
      linkStatus: 'ACTIVE',
      invitedAt: '2026-09-01T12:00:00Z',
      confirmedAt: '2026-09-02T12:00:00Z',
      features: { diarioMiccional: false, diarioEvacuatorio: true, cronometros: false },
    } as any);
    vi.mocked(patientPortalApi.updatePlan).mockResolvedValue({
      diarioMiccional: true,
      diarioEvacuatorio: true,
      cronometros: false,
    });
    renderCard({ patientCpf: '12345678901' });

    expect(await screen.findByText(/vinculada desde 02\/09\/2026/i)).toBeInTheDocument();
    const diarioMiccional = screen.getByLabelText('Diário miccional');
    expect(diarioMiccional).not.toBeChecked();
    expect(screen.getByLabelText('Diário evacuatório')).toBeChecked();

    fireEvent.click(diarioMiccional);

    await waitFor(() =>
      expect(patientPortalApi.updatePlan).toHaveBeenCalledWith('pat-1', {
        diarioMiccional: true,
        diarioEvacuatorio: true,
        cronometros: false,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Plano atualizado'));
  });

  it('ACTIVE: desabilita os switches enquanto a mutação de atualização está pendente', async () => {
    vi.mocked(patientPortalApi.getPortalStatus).mockResolvedValue({
      linkId: 'link-1',
      linkStatus: 'ACTIVE',
      invitedAt: '2026-09-01T12:00:00Z',
      confirmedAt: '2026-09-02T12:00:00Z',
      features: { diarioMiccional: false, diarioEvacuatorio: false, cronometros: false },
    } as any);

    let resolveUpdate: (v: any) => void;
    vi.mocked(patientPortalApi.updatePlan).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    renderCard({ patientCpf: '12345678901' });

    expect(await screen.findByText(/vinculada desde 02\/09\/2026/i)).toBeInTheDocument();
    const diarioMiccional = screen.getByLabelText('Diário miccional') as HTMLButtonElement;
    const diarioEvacuatorio = screen.getByLabelText('Diário evacuatório') as HTMLButtonElement;
    const cronometros = screen.getByLabelText('Cronômetros') as HTMLButtonElement;

    expect(diarioMiccional).not.toBeDisabled();

    fireEvent.click(diarioMiccional);

    // Todos os switches devem estar desabilitados enquanto a mutação está pendente
    await waitFor(() => {
      expect(diarioMiccional).toBeDisabled();
      expect(diarioEvacuatorio).toBeDisabled();
      expect(cronometros).toBeDisabled();
    });

    // Resolver a promise para simular sucesso da mutação
    resolveUpdate!({ diarioMiccional: true, diarioEvacuatorio: false, cronometros: false });

    // Após a mutação completar, os switches devem estar habilitados novamente
    await waitFor(() => {
      expect(diarioMiccional).not.toBeDisabled();
      expect(diarioEvacuatorio).not.toBeDisabled();
      expect(cronometros).not.toBeDisabled();
    });
  });
});
