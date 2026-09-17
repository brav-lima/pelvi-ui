import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from './date-picker';

describe('DatePicker', () => {
  it('mostra o placeholder quando não há valor selecionado', () => {
    render(<DatePicker value={undefined} onChange={() => {}} placeholder="Selecione uma data" />);
    expect(screen.getByText('Selecione uma data')).toBeInTheDocument();
  });

  it('mostra a data formatada em dd/MM/yyyy quando há valor', () => {
    render(<DatePicker value="2026-03-05" onChange={() => {}} />);
    expect(screen.getByText('05/03/2026')).toBeInTheDocument();
  });

  it('ao selecionar um dia no calendário, chama onChange com a data em formato yyyy-MM-dd e fecha o popover', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value="2026-03-05" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '05/03/2026' }));
    await user.click(await screen.findByRole('button', { name: /10 de março de 2026/ }));

    expect(onChange).toHaveBeenCalledWith('2026-03-10');
    await waitFor(() => expect(screen.queryByRole('grid')).not.toBeInTheDocument());
  });

  it('permite pular para outro mês/ano escolhendo nos seletores da competência, em vez de clicar em avançar/voltar repetidamente', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value="2026-03-05" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '05/03/2026' }));
    await user.selectOptions(screen.getByRole('combobox', { name: /selecionar o mês/i }), 'janeiro');
    await user.selectOptions(screen.getByRole('combobox', { name: /selecionar o ano/i }), '2027');

    await user.click(await screen.findByRole('button', { name: /15 de janeiro de 2027/ }));

    expect(onChange).toHaveBeenCalledWith('2027-01-15');
  });

  it('não chama onChange ao clicar em um dia depois de maxDate', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker
        value="2026-03-05"
        onChange={onChange}
        maxDate={new Date(2026, 2, 5)}
      />,
    );

    await user.click(screen.getByRole('button', { name: '05/03/2026' }));
    await user.click(await screen.findByRole('button', { name: /10 de março de 2026/ }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
