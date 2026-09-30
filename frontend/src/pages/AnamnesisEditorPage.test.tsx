import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    patientsApi: { getById: vi.fn() },
    anamnesisApi: { getById: vi.fn(), create: vi.fn(), update: vi.fn() },
    treatmentPackagesApi: { list: vi.fn() },
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const features: Record<string, boolean> = {};
vi.mock('@/contexts/SubscriptionContext', () => ({
  useFeature: (f: string) => features[f] ?? true,
}));

import { patientsApi, anamnesisApi, treatmentPackagesApi } from '@/lib/api';
import AnamnesisEditorPage from './AnamnesisEditorPage';
import type { Patient, Anamnesis } from '@/types/clinic';

const patient = {
  id: 'patient-1',
  name: 'Maria Silva',
  cpf: '12345678900',
  phone: '11999998888',
  birthDate: '1990-05-10T00:00:00.000Z',
  occupation: 'Professora',
  maritalStatus: 'MARRIED',
} as Patient;

const existing = (over: Partial<Anamnesis> = {}): Anamnesis => ({
  id: 'anam-1',
  organizationId: 'org-1',
  patientId: 'patient-1',
  professionalId: 'prof-1',
  type: 'PELVIC_GENERAL',
  status: 'DRAFT',
  assessmentDate: '2026-06-10T00:00:00.000Z',
  completedAt: null,
  data: { sections: { chiefComplaint: 'Queixa salva' } },
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
  professional: { id: 'prof-1', person: { name: 'Dra. Ana' } },
  ...over,
});

function renderPage(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/patients/:patientId/anamnesis/:anamnesisId" element={<AnamnesisEditorPage />} />
          <Route path="/patients/:patientId" element={<div>PERFIL DO PACIENTE</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AnamnesisEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(features)) delete features[k];
    vi.mocked(patientsApi.getById).mockResolvedValue(patient);
    vi.mocked(treatmentPackagesApi.list).mockResolvedValue([]);
  });

  describe('nova anamnese pélvica geral', () => {
    const path = '/patients/patient-1/anamnesis/new?type=PELVIC_GENERAL';

    it('renderiza as seções da ficha com placeholder e orientação, sem resumo obstétrico', async () => {
      renderPage(path);
      expect(await screen.findByRole('heading', { name: 'Queixa principal' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Sintomas urinários' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Observações complementares' })).toBeInTheDocument();
      expect(screen.getByLabelText('Queixa principal')).toHaveAttribute(
        'placeholder',
        'Descreva a principal queixa relatada pela paciente...',
      );
      expect(screen.getByTestId('field-chiefComplaint-guidance')).toHaveTextContent(/^Investigar: /);
      expect(screen.queryByText('IG atual')).not.toBeInTheDocument();
    });

    it('identificação reaproveita o cadastro (profissão e estado civil inclusive)', async () => {
      renderPage(path);
      expect(await screen.findByRole('heading', { name: 'Identificação' })).toBeInTheDocument();
      expect(screen.getByText('Professora')).toBeInTheDocument();
      expect(screen.getByText('Casado(a)')).toBeInTheDocument();
      expect(screen.getAllByText('Maria Silva').length).toBeGreaterThan(0);
    });

    it('salva rascunho sem nada preenchido (campos clínicos não são obrigatórios)', async () => {
      vi.mocked(anamnesisApi.create).mockResolvedValue({ id: 'anam-1', status: 'DRAFT' } as Anamnesis);
      renderPage(path);

      fireEvent.click(await screen.findByRole('button', { name: 'Salvar rascunho' }));

      await waitFor(() =>
        expect(anamnesisApi.create).toHaveBeenCalledWith({
          patientId: 'patient-1',
          type: 'PELVIC_GENERAL',
          assessmentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          data: { sections: {} },
        }),
      );
    });

    it('a orientação "Investigar:" nunca vai no payload', async () => {
      vi.mocked(anamnesisApi.create).mockResolvedValue({ id: 'anam-1', status: 'DRAFT' } as Anamnesis);
      renderPage(path);

      fireEvent.change(await screen.findByLabelText('Queixa principal'), {
        target: { value: 'Dor pélvica há 2 meses' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

      await waitFor(() => expect(anamnesisApi.create).toHaveBeenCalled());
      const [[payload]] = vi.mocked(anamnesisApi.create).mock.calls;
      expect(payload.data!.sections).toEqual({ chiefComplaint: 'Dor pélvica há 2 meses' });
      expect(JSON.stringify(payload)).not.toContain('Investigar');
    });

    it('"Salvar e finalizar" cria e em seguida marca como finalizada, voltando ao perfil', async () => {
      vi.mocked(anamnesisApi.create).mockResolvedValue({ id: 'anam-1', status: 'DRAFT' } as Anamnesis);
      vi.mocked(anamnesisApi.update).mockResolvedValue({ id: 'anam-1', status: 'COMPLETED' } as Anamnesis);
      renderPage(path);

      fireEvent.click(await screen.findByRole('button', { name: 'Salvar e finalizar' }));

      await waitFor(() =>
        expect(anamnesisApi.update).toHaveBeenCalledWith('anam-1', { status: 'COMPLETED' }),
      );
      expect(await screen.findByText('PERFIL DO PACIENTE')).toBeInTheDocument();
    });

    it('alterações não salvas pedem confirmação ao voltar; "Sair sem salvar" descarta', async () => {
      renderPage(path);
      fireEvent.change(await screen.findByLabelText('Queixa principal'), { target: { value: 'rascunho' } });

      fireEvent.click(screen.getByRole('button', { name: /voltar para perfil/i }));
      expect(await screen.findByText('Descartar alterações?')).toBeInTheDocument();
      expect(screen.queryByText('PERFIL DO PACIENTE')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }));
      expect(await screen.findByText('PERFIL DO PACIENTE')).toBeInTheDocument();
    });

    it('sem alterações, voltar não pergunta nada', async () => {
      renderPage(path);
      fireEvent.click(await screen.findByRole('button', { name: /voltar para perfil/i }));
      expect(await screen.findByText('PERFIL DO PACIENTE')).toBeInTheDocument();
    });
  });

  describe('nova anamnese gestacional', () => {
    it('mostra o resumo obstétrico e os campos estruturados', async () => {
      renderPage('/patients/patient-1/anamnesis/new?type=PREGNANCY');
      expect(await screen.findByText('IG atual')).toBeInTheDocument();
      expect(screen.getByLabelText(/Data da última menstruação/)).toBeInTheDocument();
      expect(screen.getByLabelText('Data do exame')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Planejamento e expectativas para o parto' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Queixa principal' })).not.toBeInTheDocument();
    });

    it('DUM informada calcula a DPP e entra no payload salvo', async () => {
      vi.mocked(anamnesisApi.create).mockResolvedValue({ id: 'anam-2', status: 'DRAFT' } as Anamnesis);
      renderPage('/patients/patient-1/anamnesis/new?type=PREGNANCY');

      fireEvent.change(await screen.findByLabelText(/Data da última menstruação/), {
        target: { value: '2026-01-01' },
      });
      expect(screen.getByLabelText(/Data provável do parto/)).toHaveValue('2026-10-08');

      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
      await waitFor(() => expect(anamnesisApi.create).toHaveBeenCalled());
      const [[payload]] = vi.mocked(anamnesisApi.create).mock.calls;
      expect(payload.type).toBe('PREGNANCY');
      expect(payload.data!.sections.gestationalData).toEqual(
        expect.objectContaining({ dum: '2026-01-01', dpp: '2026-10-08', dppSource: 'DUM' }),
      );
    });
  });

  it('type ausente ou inválido em /new redireciona ao perfil', async () => {
    renderPage('/patients/patient-1/anamnesis/new');
    expect(await screen.findByText('PERFIL DO PACIENTE')).toBeInTheDocument();

    renderPage('/patients/patient-1/anamnesis/new?type=OUTRO');
    expect((await screen.findAllByText('PERFIL DO PACIENTE')).length).toBeGreaterThan(0);
  });

  describe('editar anamnese existente', () => {
    it('rascunho: popula os campos a partir do registro e mantém o botão de rascunho', async () => {
      vi.mocked(anamnesisApi.getById).mockResolvedValue(existing());
      renderPage('/patients/patient-1/anamnesis/anam-1');

      expect(await screen.findByLabelText('Queixa principal')).toHaveValue('Queixa salva');
      expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument();
      expect(screen.getByText(/Dra\. Ana/)).toBeInTheDocument();
    });

    it('rascunho existente salva via PATCH (sem recriar) e sem status', async () => {
      vi.mocked(anamnesisApi.getById).mockResolvedValue(existing());
      vi.mocked(anamnesisApi.update).mockResolvedValue(existing());
      renderPage('/patients/patient-1/anamnesis/anam-1');

      fireEvent.change(await screen.findByLabelText('Queixa principal'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

      await waitFor(() =>
        expect(anamnesisApi.update).toHaveBeenCalledWith('anam-1', {
          data: { sections: { chiefComplaint: '' } },
          assessmentDate: '2026-06-10',
        }),
      );
      expect(anamnesisApi.create).not.toHaveBeenCalled();
    });

    it('finalizada: aviso de histórico, sem "Salvar e finalizar", salvar só habilita após editar', async () => {
      vi.mocked(anamnesisApi.getById).mockResolvedValue(existing({ status: 'COMPLETED' }));
      vi.mocked(anamnesisApi.update).mockResolvedValue(existing({ status: 'COMPLETED' }));
      renderPage('/patients/patient-1/anamnesis/anam-1');

      expect(await screen.findByText(/foi finalizada/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Salvar e finalizar' })).not.toBeInTheDocument();
      const save = screen.getByRole('button', { name: 'Salvar alterações' });
      expect(save).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Queixa principal'), { target: { value: 'Editada' } });
      expect(save).toBeEnabled();
      fireEvent.click(save);

      await waitFor(() => expect(anamnesisApi.update).toHaveBeenCalledTimes(1));
      const [, body] = vi.mocked(anamnesisApi.update).mock.calls[0];
      expect(body).not.toHaveProperty('status');
      expect(body.data).toEqual({ sections: { chiefComplaint: 'Editada' } });
    });

    it('legado (type null): somente leitura, sem botões de salvar, etiquetado "Formato anterior"', async () => {
      vi.mocked(anamnesisApi.getById).mockResolvedValue(
        existing({
          type: null,
          status: 'COMPLETED',
          data: {
            queixaPrincipal: { texto: 'Queixa antiga', hipoteses: [] },
            impacto: { texto: '', hipoteses: [] },
            historiaAtual: { texto: '', hipoteses: [] },
            historiaPregressa: { texto: '', hipoteses: [] },
          },
        }),
      );
      renderPage('/patients/patient-1/anamnesis/anam-1');

      expect(await screen.findByText(/formato anterior/i)).toBeInTheDocument();
      expect(screen.getByText('Queixa antiga')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /salvar/i })).not.toBeInTheDocument();
    });
  });

  describe('edições durante o salvamento', () => {
    const deferred = <T,>() => {
      let resolve!: (v: T) => void;
      const promise = new Promise<T>((r) => { resolve = r; });
      return { promise, resolve };
    };

    it('edição feita com o salvamento em andamento mantém "Alterações não salvas" e é salva depois', async () => {
      vi.mocked(anamnesisApi.getById).mockResolvedValue(existing());
      const first = deferred<Anamnesis>();
      vi.mocked(anamnesisApi.update)
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce(existing());
      renderPage('/patients/patient-1/anamnesis/anam-1');

      const field = await screen.findByLabelText('Queixa principal');
      fireEvent.change(field, { target: { value: 'primeira' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
      await waitFor(() => expect(anamnesisApi.update).toHaveBeenCalledTimes(1));

      fireEvent.change(field, { target: { value: 'primeira e segunda' } });
      first.resolve(existing());

      await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled());
      expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
      expect(screen.queryByText(/Salvo às/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
      await waitFor(() => expect(anamnesisApi.update).toHaveBeenCalledTimes(2));
      expect(vi.mocked(anamnesisApi.update).mock.calls[1][1].data).toEqual({
        sections: { chiefComplaint: 'primeira e segunda' },
      });
      expect(await screen.findByText(/Salvo às/)).toBeInTheDocument();
    });

    it('controle: sem edições durante o salvamento, o indicador mostra "Salvo às"', async () => {
      vi.mocked(anamnesisApi.getById).mockResolvedValue(existing());
      const first = deferred<Anamnesis>();
      vi.mocked(anamnesisApi.update).mockReturnValueOnce(first.promise);
      renderPage('/patients/patient-1/anamnesis/anam-1');

      fireEvent.change(await screen.findByLabelText('Queixa principal'), { target: { value: 'x' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
      await waitFor(() => expect(anamnesisApi.update).toHaveBeenCalledTimes(1));
      first.resolve(existing());

      expect(await screen.findByText(/Salvo às/)).toBeInTheDocument();
      expect(screen.queryByText('Alterações não salvas')).not.toBeInTheDocument();
    });
  });

  it('criar e navegar (/new -> /:anamnesisId, rotas separadas) preserva o texto digitado', async () => {
    vi.mocked(anamnesisApi.create).mockResolvedValue({ id: 'anam-1', status: 'DRAFT' } as Anamnesis);
    vi.mocked(anamnesisApi.getById).mockResolvedValue(
      existing({ data: { sections: { chiefComplaint: 'Texto digitado' } } }),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/patients/patient-1/anamnesis/new?type=PELVIC_GENERAL']}>
          <Routes>
            <Route path="/patients/:patientId/anamnesis/new" element={<AnamnesisEditorPage />} />
            <Route path="/patients/:patientId/anamnesis/:anamnesisId" element={<AnamnesisEditorPage />} />
            <Route path="/patients/:patientId" element={<div>PERFIL DO PACIENTE</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(await screen.findByLabelText('Queixa principal'), { target: { value: 'Texto digitado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

    await waitFor(() => expect(anamnesisApi.create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(anamnesisApi.getById).toHaveBeenCalledWith('anam-1'));
    expect(await screen.findByLabelText('Queixa principal')).toHaveValue('Texto digitado');
    expect(anamnesisApi.create).toHaveBeenCalledTimes(1);
  });

  it('esconde o atalho "Avaliação perineal" quando a feature está inativa', async () => {
    features.PERINEAL_ASSESSMENT = false;
    renderPage('/patients/patient-1/anamnesis/new?type=PELVIC_GENERAL');
    expect(await screen.findByRole('heading', { name: 'Queixa principal' })).toBeInTheDocument();
    expect(screen.queryByText('Avaliação perineal')).not.toBeInTheDocument();
    expect(screen.getByText('Atalhos de avaliação')).toBeInTheDocument();
  });

  it('esconde o quadro de atalhos quando nenhuma feature de atalho está ativa', async () => {
    features.PERINEAL_ASSESSMENT = false;
    features.EVOLUTIONS = false;
    features.TREATMENT_PACKAGES = false;
    renderPage('/patients/patient-1/anamnesis/new?type=PELVIC_GENERAL');
    expect(await screen.findByRole('heading', { name: 'Queixa principal' })).toBeInTheDocument();
    expect(screen.queryByText('Atalhos de avaliação')).not.toBeInTheDocument();
  });
});
