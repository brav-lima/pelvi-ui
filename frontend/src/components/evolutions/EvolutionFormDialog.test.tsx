import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    evolutionsApi: { create: vi.fn(), update: vi.fn() },
    appointmentsApi: { list: vi.fn().mockResolvedValue([]) },
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvent: { EvolutionCreated: 'evolution_created' },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string; size?: string }>(
    ({ children, loading: _l, variant: _v, size: _s, ...props }, ref) => (
      <button ref={ref} {...props}>{children}</button>
    ),
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }>(
    ({ error: _e, ...props }, ref) => <input ref={ref} {...props} />,
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }>(
    ({ error: _e, ...props }, ref) => <textarea ref={ref} {...props} />,
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: {
    children: React.ReactNode; value: string; onValueChange: (v: string) => void;
  }) => (
    <select aria-label="Atendimento relacionado" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

import { evolutionsApi, appointmentsApi } from '@/lib/api';
import { EvolutionFormDialog } from './EvolutionFormDialog';
import type { Evolution } from '@/types/clinic';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const existingEvolution: Evolution = {
  id: 'evo-1',
  organizationId: 'org-1',
  patientId: 'patient-1',
  professionalId: 'prof-1',
  description: 'Texto original',
  // Noon UTC (not midnight) so the local-time-formatted calendar day is stable
  // across every real-world timezone offset (-12..+14), including test runners
  // in UTC (CI) and in Brazil (dev machines, UTC-3).
  evolutionDate: '2026-01-10T12:00:00.000Z',
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
};

describe('EvolutionFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza título "Nova Evolução" e data de hoje por padrão em modo criação', () => {
    render(
      <EvolutionFormDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} patientId="patient-1" />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByRole('heading', { name: 'Nova Evolução' })).toBeInTheDocument();
    const today = new Date().toISOString().slice(0, 10);
    expect(screen.getByLabelText(/data da evolução/i)).toHaveValue(today);
  });

  it('chama evolutionsApi.create com description e evolutionDate ao submeter em modo criação', async () => {
    vi.mocked(evolutionsApi.create).mockResolvedValue({} as Evolution);
    render(
      <EvolutionFormDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} patientId="patient-1" />,
      { wrapper: makeWrapper() },
    );

    fireEvent.change(screen.getByLabelText(/data da evolução/i), { target: { value: '2026-02-05' } });
    fireEvent.change(screen.getByLabelText(/descrição/i), {
      target: { value: 'Paciente evoluiu bem durante a sessão de hoje.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }));

    await waitFor(() => {
      expect(evolutionsApi.create).toHaveBeenCalledWith({
        patientId: 'patient-1',
        description: 'Paciente evoluiu bem durante a sessão de hoje.',
        evolutionDate: new Date('2026-02-05T00:00:00').toISOString(),
      });
    });
  });

  it('renderiza título "Editar Evolução" e pré-popula campos em modo edição', () => {
    render(
      <EvolutionFormDialog
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        patientId="patient-1"
        evolution={existingEvolution}
      />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByRole('heading', { name: 'Editar Evolução' })).toBeInTheDocument();
    expect(screen.getByLabelText(/data da evolução/i)).toHaveValue('2026-01-10');
    expect(screen.getByLabelText(/descrição/i)).toHaveValue('Texto original');
  });

  it('chama evolutionsApi.update ao submeter em modo edição', async () => {
    vi.mocked(evolutionsApi.update).mockResolvedValue({} as Evolution);
    render(
      <EvolutionFormDialog
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        patientId="patient-1"
        evolution={existingEvolution}
      />,
      { wrapper: makeWrapper() },
    );

    fireEvent.change(screen.getByLabelText(/data da evolução/i), { target: { value: '2026-01-12' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(evolutionsApi.update).toHaveBeenCalledWith('evo-1', {
        description: 'Texto original',
        evolutionDate: new Date('2026-01-12T00:00:00').toISOString(),
        appointmentId: null,
      });
    });
  });

  it('mantém a data em fuso local ao pré-popular em modo edição, consistente com a exibição na timeline', () => {
    render(
      <EvolutionFormDialog
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        patientId="patient-1"
        evolution={existingEvolution}
      />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByLabelText(/data da evolução/i)).toHaveValue('2026-01-10');
  });

  it('não exibe erro de validação e salva com sucesso em modo edição quando a descrição tem menos de 10 caracteres', async () => {
    const shortDescriptionEvolution: Evolution = {
      ...existingEvolution,
      description: 'Ok',
    };
    vi.mocked(evolutionsApi.update).mockResolvedValue({} as Evolution);
    render(
      <EvolutionFormDialog
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        patientId="patient-1"
        evolution={shortDescriptionEvolution}
      />,
      { wrapper: makeWrapper() },
    );

    expect(screen.getByLabelText(/descrição/i)).toHaveValue('Ok');

    fireEvent.change(screen.getByLabelText(/data da evolução/i), { target: { value: '2026-01-15' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(evolutionsApi.update).toHaveBeenCalledWith('evo-1', {
        description: 'Ok',
        evolutionDate: new Date('2026-01-15T00:00:00').toISOString(),
        appointmentId: null,
      });
    });
    expect(screen.queryByText(/descrição deve ter pelo menos/i)).not.toBeInTheDocument();
  });

  it('rejeita descrição com menos de 10 caracteres em modo criação', async () => {
    render(
      <EvolutionFormDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} patientId="patient-1" />,
      { wrapper: makeWrapper() },
    );

    fireEvent.change(screen.getByLabelText(/data da evolução/i), { target: { value: '2026-02-05' } });
    fireEvent.change(screen.getByLabelText(/descrição/i), { target: { value: 'Curta' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }));

    await waitFor(() => {
      expect(screen.getByText(/descrição deve ter pelo menos 10 caracteres/i)).toBeInTheDocument();
    });
    expect(evolutionsApi.create).not.toHaveBeenCalled();
  });

  it('lista os atendimentos do paciente e envia appointmentId ao selecionar um', async () => {
    vi.mocked(appointmentsApi.list).mockResolvedValue([
      { id: 'apt-1', startAt: '2026-02-05T13:00:00.000Z', status: 'DONE', procedure: { name: 'Fisioterapia' } },
    ] as never);
    vi.mocked(evolutionsApi.create).mockResolvedValue({} as Evolution);

    render(
      <EvolutionFormDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} patientId="patient-1" />,
      { wrapper: makeWrapper() },
    );

    await screen.findByRole('option', { name: /Fisioterapia/i });

    fireEvent.change(screen.getByLabelText(/atendimento relacionado/i), { target: { value: 'apt-1' } });
    fireEvent.change(screen.getByLabelText(/data da evolução/i), { target: { value: '2026-02-05' } });
    fireEvent.change(screen.getByLabelText(/descrição/i), {
      target: { value: 'Paciente evoluiu bem durante a sessão de hoje.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }));

    await waitFor(() => {
      expect(evolutionsApi.create).toHaveBeenCalledWith({
        patientId: 'patient-1',
        description: 'Paciente evoluiu bem durante a sessão de hoje.',
        evolutionDate: new Date('2026-02-05T00:00:00').toISOString(),
        appointmentId: 'apt-1',
      });
    });
  });

  it('pré-popula o atendimento vinculado em modo edição', async () => {
    vi.mocked(appointmentsApi.list).mockResolvedValue([
      { id: 'apt-1', startAt: '2026-01-10T13:00:00.000Z', status: 'DONE' },
    ] as never);
    const evolutionWithAppointment: Evolution = {
      ...existingEvolution,
      appointment: { id: 'apt-1', startAt: '2026-01-10T13:00:00.000Z', status: 'DONE' },
    };
    render(
      <EvolutionFormDialog
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        patientId="patient-1"
        evolution={evolutionWithAppointment}
      />,
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/atendimento relacionado/i)).toHaveValue('apt-1');
    });
  });
});
