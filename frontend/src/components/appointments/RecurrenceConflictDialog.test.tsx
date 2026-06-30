import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecurrenceConflictDialog } from './RecurrenceConflictDialog';

const conflicts = [
  { date: new Date('2026-07-06T10:00:00'), nextAvailable: new Date('2026-07-07T10:00:00') },
  { date: new Date('2026-07-13T10:00:00'), nextAvailable: null },
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
    expect(screen.getByText(/07\/07\/2026/)).toBeInTheDocument();
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
      { originalDate: conflicts[0].date, resolvedDate: conflicts[0].nextAvailable },
      { originalDate: conflicts[1].date, resolvedDate: null },
    ]);
  });
});
