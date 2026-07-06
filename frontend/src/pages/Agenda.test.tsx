import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// ── Module mocks ───────────────────────────────────────────────────────────────
// Scoped narrowly to what's needed to reach the CANCELED/CONFIRMED status-action
// buttons in the appointment details dialog — this is NOT a full Agenda test suite.

vi.mock('@/lib/api', () => ({
  appointmentsApi: {
    list: vi.fn(),
    updateStatus: vi.fn(),
  },
  professionalsApi: {
    list: vi.fn(),
  },
  organizationApi: {
    getProfile: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvent: { AppointmentCanceled: 'appointment_canceled' },
}));

// Dialog is Radix-portal based — mock it the same way AppointmentFormDialog.test.tsx does.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// AlertDialog is only reached via the treatment-package cancel flow, not exercised
// by these two tests, but the component tree still needs it to be a safe no-op.
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

// Both are heavy dialogs unrelated to the status-mutation path — render nothing.
vi.mock('@/components/appointments/AppointmentFormDialog', () => ({
  AppointmentFormDialog: () => null,
}));
vi.mock('@/components/appointments/RecurrenceScopeDialog', () => ({
  RecurrenceScopeDialog: () => null,
}));

// @dnd-kit needs real pointer/sensor wiring we don't exercise here — stub it out
// so the day/week grid renders without requiring drag interactions.
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: () => null,
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => undefined, isDragging: false }),
  useDroppable: () => ({ setNodeRef: () => undefined, isOver: false }),
}));

import { appointmentsApi, professionalsApi, organizationApi } from '@/lib/api';
import { track } from '@/lib/analytics';
import Agenda from './Agenda';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const baseAppointment = {
  id: 'apt1',
  patientId: 'p1',
  professionalId: 'pr1',
  procedureId: 'proc1',
  startAt: new Date().toISOString(),
  endAt: new Date().toISOString(),
  status: 'SCHEDULED' as const,
  treatmentPackageId: null,
  patient: { id: 'p1', name: 'Maria Costa' },
  professional: { person: { name: 'Dr. João' } },
  procedure: { name: 'Fisioterapia', durationMinutes: 60, price: 100 },
};

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

function renderAgenda() {
  return render(<Agenda />, { wrapper: makeWrapper() });
}

/** Renders the page, waits for the appointment card, and opens its details dialog. */
async function openAppointmentDialog() {
  renderAgenda();

  await waitFor(() => {
    expect(screen.getByText('Maria Costa')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByText('Maria Costa').closest('button')!);

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
}

describe('Agenda — status mutation analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(appointmentsApi.list).mockResolvedValue([baseAppointment] as any);
    vi.mocked(professionalsApi.list).mockResolvedValue([] as any);
    vi.mocked(organizationApi.getProfile).mockResolvedValue({ settings: {} } as any);
  });

  it('dispara track(appointment_canceled) quando o status muda para CANCELED', async () => {
    vi.mocked(appointmentsApi.updateStatus).mockResolvedValue({
      ...baseAppointment,
      status: 'CANCELED',
    } as any);

    await openAppointmentDialog();

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    await waitFor(() => {
      expect(appointmentsApi.updateStatus).toHaveBeenCalledWith('apt1', 'CANCELED', { deductFromPackage: undefined });
    });
    await waitFor(() => {
      expect(track).toHaveBeenCalledWith('appointment_canceled');
    });
  });

  it('não dispara track(appointment_canceled) quando o status muda para CONFIRMED', async () => {
    vi.mocked(appointmentsApi.updateStatus).mockResolvedValue({
      ...baseAppointment,
      status: 'CONFIRMED',
    } as any);

    await openAppointmentDialog();

    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => {
      expect(appointmentsApi.updateStatus).toHaveBeenCalledWith('apt1', 'CONFIRMED', { deductFromPackage: undefined });
    });
    expect(track).not.toHaveBeenCalled();
  });
});
