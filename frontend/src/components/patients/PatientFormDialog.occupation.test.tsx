import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, patientsApi: { create: vi.fn(), update: vi.fn() } };
});
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvent: { PatientCreated: 'patient_created' },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { patientsApi } from '@/lib/api';
import { PatientFormDialog } from './PatientFormDialog';

describe('PatientFormDialog — profissão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patientsApi.create).mockResolvedValue({ id: 'p1', name: 'Maria' } as never);
  });

  it('envia a profissão digitada no cadastro completo', async () => {
    render(<PatientFormDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Maria Silva' } });
    fireEvent.change(screen.getByLabelText('Profissão'), { target: { value: 'Professora' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() =>
      expect(patientsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Maria Silva', occupation: 'Professora' }),
      ),
    );
  });

  it('não mostra Profissão no cadastro rápido', () => {
    render(<PatientFormDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} mode="quick" />);
    expect(screen.queryByLabelText('Profissão')).not.toBeInTheDocument();
  });

  it('preenche a profissão ao editar', () => {
    render(
      <PatientFormDialog
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        patient={{ id: 'p1', name: 'Maria', occupation: 'Médica', status: 'ACTIVE' } as never}
      />,
    );
    expect(screen.getByLabelText('Profissão')).toHaveValue('Médica');
  });
});
