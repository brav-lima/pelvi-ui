import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecurrenceConflictDialog } from './RecurrenceConflictDialog';

const conflicts = [
  { date: new Date('2026-07-06T10:00:00'), nextAvailableDate: new Date('2026-07-07T10:00:00') },
  { date: new Date('2026-07-13T10:00:00'), nextAvailableDate: new Date('2026-07-14T10:00:00') },
];

describe('RecurrenceConflictDialog', () => {
  it('renders each conflict date', () => {
    render(
      <RecurrenceConflictDialog
        open={true}
        onOpenChange={vi.fn()}
        conflicts={conflicts}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/06\/07\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/13\/07\/2026/)).toBeInTheDocument();
  });

  it('shows next available date when available', () => {
    render(
      <RecurrenceConflictDialog
        open={true}
        onOpenChange={vi.fn()}
        conflicts={conflicts}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/próximo dia disponível \(07\/07\)/i)).toBeInTheDocument();
  });

  it('calls onConfirm with resolved dates using defaults', () => {
    const onConfirm = vi.fn();
    render(
      <RecurrenceConflictDialog
        open={true}
        onOpenChange={vi.fn()}
        conflicts={conflicts}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onConfirm).toHaveBeenCalledWith([
      { date: conflicts[0].date, action: 'reschedule', resolvedDate: conflicts[0].nextAvailableDate },
      { date: conflicts[1].date, action: 'reschedule', resolvedDate: conflicts[1].nextAvailableDate },
    ]);
  });
});
