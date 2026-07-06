import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// ── Hoisted state (available inside vi.mock factories) ─────────────────────────

const capturedCallbacks = vi.hoisted(() => ({
  onConfirm: null as ((resolutions: any[]) => void) | null,
}));

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    appointmentsApi: { create: vi.fn(), createBulk: vi.fn() },
    patientsApi: { list: vi.fn() },
    professionalsApi: { list: vi.fn() },
    proceduresApi: { list: vi.fn() },
    treatmentPackagesApi: { list: vi.fn() },
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvent: { AppointmentCreated: 'appointment_created' },
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

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: {
    children: React.ReactNode; value: string; onValueChange: (v: string) => void;
  }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  // Return null so they don't create invalid DOM (div inside select)
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string; size?: string; children?: React.ReactNode }>(
    ({ children, loading: _l, variant: _v, size: _s, ...props }, ref) => (
      <button ref={ref} {...props}>{children}</button>
    ),
  ),
}));

vi.mock('@/components/ui/input', () => ({
  // forwardRef is required so react-hook-form's register() ref callback reaches the DOM element
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
  Textarea: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    (props, ref) => <textarea ref={ref} {...props} />,
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement> & {
      checked?: boolean;
      onCheckedChange?: (checked: boolean) => void;
    }
  >(({ checked, onCheckedChange, id, ...props }, ref) => (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      checked={checked ?? false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  )),
}));

vi.mock('./RecurrenceConflictDialog', () => ({
  RecurrenceConflictDialog: ({ open, onConfirm }: { open: boolean; onConfirm: (r: any[]) => void; conflicts?: any }) => {
    capturedCallbacks.onConfirm = onConfirm;
    return open ? <div data-testid="conflict-dialog" /> : null;
  },
}));

import { appointmentsApi, patientsApi, professionalsApi, proceduresApi, treatmentPackagesApi, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import { track } from '@/lib/analytics';
import { AppointmentFormDialog, generateRecurrenceDates } from './AppointmentFormDialog';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const patient = { id: 'p1', name: 'Maria Costa', cpf: null, birthDate: null, email: null, phone: null };
const professional = { id: 'pr1', active: true, person: { id: 'per1', name: 'Dr. João', email: null, phone: null, cpf: null } };
const procedure = { id: 'proc1', name: 'Fisioterapia', durationMinutes: 60, price: 200, active: true };

const mockAppointment = {
  id: 'apt1',
  patientId: 'p1',
  professionalId: 'pr1',
  procedureId: 'proc1',
  startAt: '2026-06-01T09:00:00.000Z',
  endAt: '2026-06-01T10:00:00.000Z',
  status: 'SCHEDULED' as const,
  notes: null,
};

// 2026-06-01 is a Monday; businessHours blocks 09:00 (before 10:00 opening), Tuesday onward is open
const blockingBusinessHours = [
  { day: 'MONDAY', from: '10:00', to: '18:00', enabled: true },
  { day: 'TUESDAY', from: '08:00', to: '18:00', enabled: true },
  { day: 'WEDNESDAY', from: '08:00', to: '18:00', enabled: true },
  { day: 'THURSDAY', from: '08:00', to: '18:00', enabled: true },
  { day: 'FRIDAY', from: '08:00', to: '18:00', enabled: true },
];

function pagedPatients(data: unknown[]) {
  return { data, meta: { total: data.length, page: 1, limit: 100, totalPages: 1 } } as any;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

function renderDialog(props: Partial<{
  open: boolean; defaultDate: string; defaultTime: string;
  onOpenChange: ReturnType<typeof vi.fn>; onSuccess: ReturnType<typeof vi.fn>;
  businessHours: any[]; appointment: any;
}> = {}) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
    defaultDate: '2026-06-01',
    defaultTime: '09:00',
  };
  return render(<AppointmentFormDialog {...defaults} {...props} />, { wrapper: makeWrapper() });
}

/** Wait for async queries to resolve — polls until the patient option is in the DOM */
async function waitForForm() {
  await waitFor(() => {
    expect(document.querySelector('option[value="p1"]')).not.toBeNull();
  });
}

/** Fill all required form fields via the native select/input elements */
async function fillForm() {
  await waitForForm();

  const selects = screen.getAllByRole('combobox');
  // Order: patient, professional, procedure, time
  await act(async () => {
    fireEvent.change(selects[0], { target: { value: 'p1' } });   // patient
    fireEvent.change(selects[1], { target: { value: 'pr1' } });  // professional
    fireEvent.change(selects[2], { target: { value: 'proc1' } }); // procedure
    fireEvent.change(selects[3], { target: { value: '09:00' } }); // time
  });

  // Date is a native input registered with react-hook-form
  const dateInput = screen.getByLabelText('Data *');
  await act(async () => {
    fireEvent.change(dateInput, { target: { value: '2026-06-01' } });
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AppointmentFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patientsApi.list).mockResolvedValue(pagedPatients([patient]));
    vi.mocked(professionalsApi.list).mockResolvedValue([professional] as any);
    vi.mocked(proceduresApi.list).mockResolvedValue([procedure] as any);
    vi.mocked(treatmentPackagesApi.list).mockResolvedValue([] as any);
    capturedCallbacks.onConfirm = null;
  });

  it('não renderiza quando fechado', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renderiza o título "Novo Agendamento" quando aberto', () => {
    renderDialog();
    expect(screen.getByRole('heading', { name: 'Novo Agendamento' })).toBeInTheDocument();
  });

  it('exibe o botão de submit', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /agendar/i })).toBeInTheDocument();
  });

  it('chama appointmentsApi.create com os dados corretos ao submeter', async () => {
    vi.mocked(appointmentsApi.create).mockResolvedValue({} as any);
    renderDialog();
    await fillForm();

    fireEvent.click(screen.getByRole('button', { name: /agendar/i }));

    await waitFor(() => {
      expect(appointmentsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'p1',
          professionalId: 'pr1',
          procedureId: 'proc1',
        }),
      );
    });
  });

  it('chama onSuccess e fecha o dialog após criar com sucesso', async () => {
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(appointmentsApi.create).mockResolvedValue({} as any);
    render(
      <AppointmentFormDialog
        open
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
        defaultDate="2026-06-01"
        defaultTime="09:00"
      />,
      { wrapper: makeWrapper() },
    );

    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: /agendar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(toast.success).toHaveBeenCalledWith('Agendamento criado com sucesso');
    });
  });

  it('dispara analytics track(appointment_created) ao criar com sucesso', async () => {
    vi.mocked(appointmentsApi.create).mockResolvedValue({} as any);
    renderDialog();
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: /agendar/i }));

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith('appointment_created');
    });
  });

  it('exibe mensagem de erro genérica quando a API falha com erro desconhecido', async () => {
    vi.mocked(appointmentsApi.create).mockRejectedValue(new Error('unexpected'));
    renderDialog();
    await fillForm();

    fireEvent.click(screen.getByRole('button', { name: /agendar/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erro ao criar agendamento');
    });
    expect(screen.getByText(/erro ao criar agendamento\. tente novamente/i)).toBeInTheDocument();
  });

  it('exibe mensagem de conflito de horário quando a API retorna 409', async () => {
    vi.mocked(appointmentsApi.create).mockRejectedValue(new ApiError(409, 'Conflict'));
    renderDialog();
    await fillForm();

    fireEvent.click(screen.getByRole('button', { name: /agendar/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Conflito de horário');
    });
    expect(screen.getByText(/já existe um agendamento/i)).toBeInTheDocument();
  });

  it('fecha o dialog e atualiza o cache ao receber timeout (408)', async () => {
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(appointmentsApi.create).mockRejectedValue(new ApiError(408, 'timeout'));
    render(
      <AppointmentFormDialog
        open
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
        defaultDate="2026-06-01"
        defaultTime="09:00"
      />,
      { wrapper: makeWrapper() },
    );

    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: /agendar/i }));

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Tempo limite excedido'));
      expect(onSuccess).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('inclui startAt em formato ISO construído a partir da data e horário', async () => {
    vi.mocked(appointmentsApi.create).mockResolvedValue({} as any);
    renderDialog({ defaultDate: '2026-06-15', defaultTime: '14:00' });

    await waitForForm();
    const selects = screen.getAllByRole('combobox');
    await act(async () => {
      fireEvent.change(selects[0], { target: { value: 'p1' } });
      fireEvent.change(selects[1], { target: { value: 'pr1' } });
      fireEvent.change(selects[2], { target: { value: 'proc1' } });
      fireEvent.change(selects[3], { target: { value: '14:00' } });
    });
    const dateInput = screen.getByLabelText('Data *');
    await act(async () => {
      fireEvent.change(dateInput, { target: { value: '2026-06-15' } });
    });

    fireEvent.click(screen.getByRole('button', { name: /agendar/i }));

    await waitFor(() => {
      const call = vi.mocked(appointmentsApi.create).mock.calls[0][0];
      // startAt is the ISO string of "2026-06-15T14:00" in local timezone — we verify it's a valid ISO string
      // that encodes the correct local date/time
      const reconstructed = new Date('2026-06-15T14:00:00').toISOString();
      expect(call.startAt).toBe(reconstructed);
    });
  });

  // ── Repeat scheduling tests ────────────────────────────────────────────────

  it('hides repeat section in edit mode', () => {
    render(
      <AppointmentFormDialog
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        appointment={mockAppointment}
      />,
      { wrapper: makeWrapper() },
    );
    expect(screen.queryByLabelText(/repetir agendamento/i)).not.toBeInTheDocument();
  });

  it('generateRecurrenceDates generates correct dates for daily pattern', () => {
    const base = new Date('2026-07-01T10:00:00');
    const dates = generateRecurrenceDates(base, 'daily', 3);
    expect(dates).toHaveLength(3);
    expect(dates[0].toISOString().slice(0, 10)).toBe('2026-07-02');
    expect(dates[1].toISOString().slice(0, 10)).toBe('2026-07-03');
    expect(dates[2].toISOString().slice(0, 10)).toBe('2026-07-04');
  });

  it('generateRecurrenceDates generates correct dates for weekly pattern', () => {
    const base = new Date('2026-07-01T10:00:00');
    const dates = generateRecurrenceDates(base, 'weekly', 2);
    expect(dates[0].toISOString().slice(0, 10)).toBe('2026-07-08');
    expect(dates[1].toISOString().slice(0, 10)).toBe('2026-07-15');
  });

  it('generateRecurrenceDates generates correct dates for monthly pattern', () => {
    const base = new Date('2026-07-01T10:00:00');
    const dates = generateRecurrenceDates(base, 'monthly', 2);
    expect(dates[0].toISOString().slice(0, 10)).toBe('2026-08-01');
    expect(dates[1].toISOString().slice(0, 10)).toBe('2026-09-01');
  });

  it('shows conflict dialog when a generated date is blocked by business hours', async () => {
    // 2026-06-01 is Monday; 09:00 is before the 10:00 opening → slot is blocked
    vi.mocked(appointmentsApi.createBulk).mockResolvedValue({} as any);

    renderDialog({ businessHours: blockingBusinessHours });
    await fillForm();

    // Enable repeat (repeatCount defaults to 1, pattern defaults to daily)
    const repeatCheckbox = screen.getByLabelText(/repetir agendamento/i);
    await act(async () => {
      fireEvent.click(repeatCheckbox);
    });

    fireEvent.click(screen.getByRole('button', { name: /agendar/i }));

    await waitFor(() => {
      expect(screen.getByTestId('conflict-dialog')).toBeInTheDocument();
    });
  });

  it('calls createBulk when conflict is confirmed', async () => {
    // Same setup as conflict-dialog test
    vi.mocked(appointmentsApi.createBulk).mockResolvedValue({} as any);

    renderDialog({ businessHours: blockingBusinessHours });
    await fillForm();

    const repeatCheckbox = screen.getByLabelText(/repetir agendamento/i);
    await act(async () => {
      fireEvent.click(repeatCheckbox);
    });

    fireEvent.click(screen.getByRole('button', { name: /agendar/i }));

    await waitFor(() => {
      expect(screen.getByTestId('conflict-dialog')).toBeInTheDocument();
    });

    // Resolve conflicts: empty resolutions = skip blocked dates
    await act(async () => {
      capturedCallbacks.onConfirm!([]);
    });

    await waitFor(() => {
      expect(appointmentsApi.createBulk).toHaveBeenCalled();
    });
  });
});
