import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    professionalsApi: { lookup: vi.fn(), invite: vi.fn() },
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));

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
  Button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string }>(
    ({ children, loading: _l, variant: _v, ...props }, ref) => (
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

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: {
    children: React.ReactNode; value: string; onValueChange: (v: string) => void;
  }) => (
    <select aria-label="Cargo" value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">Selecione</option>
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

import { professionalsApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { ProfessionalFormDialog } from './ProfessionalFormDialog';

const CPF_RAW = '52998224725';

function renderDialog() {
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();
  render(<ProfessionalFormDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />);
  return { onSuccess, onOpenChange };
}

async function advancePastCpf() {
  fireEvent.change(screen.getByLabelText('CPF'), { target: { value: CPF_RAW } });
  fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
}

describe('ProfessionalFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ selectedClinic: { id: 'clinic-1' } } as never);
  });

  it('vincula profissional já existente sem exigir senha', async () => {
    vi.mocked(professionalsApi.lookup).mockResolvedValue({
      exists: true,
      maskedName: 'Ma*** Sa****',
      maskedEmail: 'm***@g***.com',
    });
    vi.mocked(professionalsApi.invite).mockResolvedValue({});

    renderDialog();
    await advancePastCpf();

    await screen.findByText('Ma*** Sa****');
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cargo'), { target: { value: 'PROFESSIONAL' } });
    fireEvent.click(screen.getByRole('button', { name: /vincular/i }));

    await waitFor(() => {
      expect(professionalsApi.invite).toHaveBeenCalledWith({
        cpf: CPF_RAW,
        role: 'PROFESSIONAL',
      });
    });
  });

  it('cadastra novo profissional com dados completos quando o CPF não existe', async () => {
    vi.mocked(professionalsApi.lookup).mockResolvedValue({ exists: false });
    vi.mocked(professionalsApi.invite).mockResolvedValue({});

    renderDialog();
    await advancePastCpf();

    const passwordField = await screen.findByLabelText(/senha/i);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Dra. Nova' } });
    fireEvent.change(screen.getByLabelText(/e-?mail/i), { target: { value: 'nova@clinica.com' } });
    fireEvent.change(passwordField, { target: { value: 'segredo123' } });
    fireEvent.change(screen.getByLabelText('Cargo'), { target: { value: 'PROFESSIONAL' } });
    fireEvent.click(screen.getByRole('button', { name: /cadastrar/i }));

    await waitFor(() => {
      expect(professionalsApi.invite).toHaveBeenCalledWith(
        expect.objectContaining({
          cpf: CPF_RAW,
          role: 'PROFESSIONAL',
          name: 'Dra. Nova',
          email: 'nova@clinica.com',
          password: 'segredo123',
        }),
      );
    });
  });

  it('exibe erro quando o profissional já está vinculado à clínica (409)', async () => {
    const { toast } = await import('sonner');
    vi.mocked(professionalsApi.lookup).mockResolvedValue({
      exists: true,
      maskedName: 'Ma*** Sa****',
      maskedEmail: 'm***@g***.com',
    });
    vi.mocked(professionalsApi.invite).mockRejectedValue(
      new ApiError(409, 'Este profissional já está vinculado a esta clínica'),
    );

    renderDialog();
    await advancePastCpf();
    await screen.findByText('Ma*** Sa****');
    fireEvent.change(screen.getByLabelText('Cargo'), { target: { value: 'PROFESSIONAL' } });
    fireEvent.click(screen.getByRole('button', { name: /vincular/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/vinculad/i));
    });
  });
});
