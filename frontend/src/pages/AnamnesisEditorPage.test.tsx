import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    patientsApi: { getById: vi.fn() },
    anamnesisApi: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
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

const patient: Patient = {
  id: 'patient-1',
  organizationId: 'org-1',
  name: 'Maria Silva',
  cpf: '12345678900',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as Patient;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:patientId/anamnesis/:anamnesisId" element={<AnamnesisEditorPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: makeWrapper() },
  );
}

describe('AnamnesisEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(features)) delete features[k];
    vi.mocked(patientsApi.getById).mockResolvedValue(patient);
    vi.mocked(anamnesisApi.list).mockResolvedValue([]);
    vi.mocked(treatmentPackagesApi.list).mockResolvedValue([]);
  });

  it('renderiza os 4 campos universais numa página única, sem seleção de template', async () => {
    renderPage('/patients/patient-1/anamnesis/new');
    expect(await screen.findByText('Queixa Principal')).toBeInTheDocument();
    expect(screen.getByText('Impacto na Vida')).toBeInTheDocument();
    expect(screen.getByText('História Atual')).toBeInTheDocument();
    expect(screen.getByText('História Pregressa')).toBeInTheDocument();
    expect(screen.queryByText(/escolha o modelo de anamnese/i)).not.toBeInTheDocument();
  });

  it('salva payload sem _template ao clicar em Salvar rascunho', async () => {
    vi.mocked(anamnesisApi.create).mockResolvedValue({ id: 'anam-1' } as Anamnesis);
    renderPage('/patients/patient-1/anamnesis/new');

    fireEvent.change(await screen.findByRole('textbox', { name: /qual o motivo da sua consulta/i }), {
      target: { value: 'Dor pélvica há 2 meses' },
    });
    fireEvent.click(screen.getByRole('button', { name: /salvar rascunho/i }));

    await waitFor(() => {
      expect(anamnesisApi.create).toHaveBeenCalledWith({
        patientId: 'patient-1',
        data: expect.objectContaining({
          queixaPrincipal: { texto: 'Dor pélvica há 2 meses', hipoteses: [] },
          impacto: { texto: '', hipoteses: [] },
          historiaAtual: { texto: '', hipoteses: [] },
          historiaPregressa: { texto: '', hipoteses: [] },
        }),
      });
      const [[payload]] = vi.mocked(anamnesisApi.create).mock.calls;
      expect(payload.data).not.toHaveProperty('_template');
    });
  });

  it('popula os campos a partir de uma anamnese existente no formato novo', async () => {
    const existing: Anamnesis = {
      id: 'anam-1',
      organizationId: 'org-1',
      patientId: 'patient-1',
      professionalId: 'prof-1',
      data: {
        queixaPrincipal: { texto: 'Queixa salva', hipoteses: ['Hipótese salva'] },
        impacto: { texto: '', hipoteses: [] },
        historiaAtual: { texto: '', hipoteses: [] },
        historiaPregressa: { texto: '', hipoteses: [] },
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    vi.mocked(anamnesisApi.list).mockResolvedValue([existing]);

    renderPage('/patients/patient-1/anamnesis/anam-1');

    expect(await screen.findByRole('textbox', { name: /qual o motivo da sua consulta/i })).toHaveValue('Queixa salva');
    // "Hipótese salva" legitimately renders twice: once inline under the field
    // (HypothesisField) and once in the aggregated summary (GroupedHypotheses).
    expect(screen.getAllByText('Hipótese salva').length).toBeGreaterThan(0);
  });

  it('mostra o atalho "Avaliação perineal" quando a feature está ativa', async () => {
    renderPage('/patients/patient-1/anamnesis/new');
    expect(await screen.findByText('Queixa Principal')).toBeInTheDocument();
    expect(screen.getByText('Avaliação perineal')).toBeInTheDocument();
  });

  it('esconde o atalho "Avaliação perineal" quando a feature está inativa', async () => {
    features.PERINEAL_ASSESSMENT = false;
    renderPage('/patients/patient-1/anamnesis/new');
    expect(await screen.findByText('Queixa Principal')).toBeInTheDocument();
    expect(screen.queryByText('Avaliação perineal')).not.toBeInTheDocument();
    // outros atalhos permanecem, então o quadro continua visível
    expect(screen.getByText('Atalhos de avaliação')).toBeInTheDocument();
  });

  it('esconde o quadro "Atalhos de avaliação" quando nenhuma feature de atalho está ativa', async () => {
    features.PERINEAL_ASSESSMENT = false;
    features.EVOLUTIONS = false;
    features.TREATMENT_PACKAGES = false;
    renderPage('/patients/patient-1/anamnesis/new');
    expect(await screen.findByText('Queixa Principal')).toBeInTheDocument();
    expect(screen.queryByText('Atalhos de avaliação')).not.toBeInTheDocument();
  });
});
