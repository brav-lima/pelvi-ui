import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecurrenceScopeDialog } from './RecurrenceScopeDialog';

describe('RecurrenceScopeDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open is true', () => {
    render(
      <RecurrenceScopeDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('Editar agendamento recorrente')).toBeInTheDocument();
    expect(
      screen.getByText('Este agendamento faz parte de uma série. Qual alteração deseja aplicar?')
    ).toBeInTheDocument();
  });

  it('does not render dialog when open is false', () => {
    render(
      <RecurrenceScopeDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.queryByText('Editar agendamento recorrente')).not.toBeInTheDocument();
  });

  it('displays both scope options', () => {
    render(
      <RecurrenceScopeDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('Somente este agendamento')).toBeInTheDocument();
    expect(screen.getByText('Apenas este será alterado.')).toBeInTheDocument();

    expect(screen.getByText('Este e todos os seguintes')).toBeInTheDocument();
    expect(screen.getByText('Este e os próximos da série serão alterados.')).toBeInTheDocument();
  });

  it('has "single" selected by default', () => {
    render(
      <RecurrenceScopeDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />
    );

    const singleRadio = screen.getByRole('radio', {
      name: /Somente este agendamento/i,
    });
    expect(singleRadio).toBeChecked();
  });

  it('allows user to change selection to "forward"', async () => {
    const user = userEvent.setup();
    render(
      <RecurrenceScopeDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />
    );

    const forwardRadio = screen.getByRole('radio', {
      name: /Este e todos os seguintes/i,
    });

    await user.click(forwardRadio);
    expect(forwardRadio).toBeChecked();
  });

  it('calls onOpenChange with false when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RecurrenceScopeDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Cancelar/i });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onConfirm with "single" when continue is clicked with default selection', async () => {
    const user = userEvent.setup();
    render(
      <RecurrenceScopeDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />
    );

    const continueButton = screen.getByRole('button', { name: /Continuar/i });
    await user.click(continueButton);

    expect(mockOnConfirm).toHaveBeenCalledWith('single');
  });

  it('calls onConfirm with "forward" when continue is clicked after selecting forward', async () => {
    const user = userEvent.setup();
    render(
      <RecurrenceScopeDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />
    );

    const forwardRadio = screen.getByRole('radio', {
      name: /Este e todos os seguintes/i,
    });
    await user.click(forwardRadio);

    const continueButton = screen.getByRole('button', { name: /Continuar/i });
    await user.click(continueButton);

    expect(mockOnConfirm).toHaveBeenCalledWith('forward');
  });

  it('maintains selection state when switching between options', async () => {
    const user = userEvent.setup();
    render(
      <RecurrenceScopeDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onConfirm={mockOnConfirm}
      />
    );

    const singleRadio = screen.getByRole('radio', {
      name: /Somente este agendamento/i,
    });
    const forwardRadio = screen.getByRole('radio', {
      name: /Este e todos os seguintes/i,
    });

    expect(singleRadio).toBeChecked();

    await user.click(forwardRadio);
    expect(forwardRadio).toBeChecked();
    expect(singleRadio).not.toBeChecked();

    await user.click(singleRadio);
    expect(singleRadio).toBeChecked();
    expect(forwardRadio).not.toBeChecked();
  });
});
