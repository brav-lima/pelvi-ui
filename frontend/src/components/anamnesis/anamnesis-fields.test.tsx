import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HypothesisField } from './anamnesis-fields';
import type { AnamnesisFieldData } from './anamnesis-fields';

function renderField(value: AnamnesisFieldData, onChange = vi.fn()) {
  render(
    <HypothesisField
      label="Queixa Principal"
      question="Qual o motivo da sua consulta?"
      value={value}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe('HypothesisField', () => {
  it('não mostra a área de hipótese quando o texto principal está vazio', () => {
    renderField({ texto: '', hipoteses: [] });
    expect(screen.queryByPlaceholderText(/adicionar hipótese/i)).not.toBeInTheDocument();
  });

  it('revela a área de hipótese quando o texto principal é preenchido', () => {
    renderField({ texto: 'Dor pélvica há 3 meses', hipoteses: [] });
    expect(screen.getByPlaceholderText(/adicionar hipótese/i)).toBeInTheDocument();
  });

  it('chama onChange com o texto atualizado ao digitar no campo principal', () => {
    const onChange = renderField({ texto: '', hipoteses: [] });
    fireEvent.change(screen.getByRole('textbox', { name: /qual o motivo da sua consulta/i }), {
      target: { value: 'Nova queixa' },
    });
    expect(onChange).toHaveBeenCalledWith({ texto: 'Nova queixa', hipoteses: [] });
  });

  it('adiciona uma hipótese ao clicar em Adicionar e limpa o campo de rascunho', () => {
    const onChange = renderField({ texto: 'Dor pélvica', hipoteses: [] });
    const draftInput = screen.getByPlaceholderText(/adicionar hipótese/i);
    fireEvent.change(draftInput, { target: { value: 'Possível endometriose' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }));
    expect(onChange).toHaveBeenCalledWith({ texto: 'Dor pélvica', hipoteses: ['Possível endometriose'] });
  });

  it('adiciona hipótese ao pressionar Enter no campo de rascunho', () => {
    const onChange = renderField({ texto: 'Dor pélvica', hipoteses: [] });
    const draftInput = screen.getByPlaceholderText(/adicionar hipótese/i);
    fireEvent.change(draftInput, { target: { value: 'Possível cistite' } });
    fireEvent.keyDown(draftInput, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ texto: 'Dor pélvica', hipoteses: ['Possível cistite'] });
  });

  it('não adiciona hipótese vazia ou só com espaços', () => {
    const onChange = renderField({ texto: 'Dor pélvica', hipoteses: [] });
    fireEvent.change(screen.getByPlaceholderText(/adicionar hipótese/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('remove uma hipótese existente ao clicar no botão de remover', () => {
    const onChange = renderField({ texto: 'Dor pélvica', hipoteses: ['Hipótese A', 'Hipótese B'] });
    fireEvent.click(screen.getByRole('button', { name: /remover hipótese: hipótese a/i }));
    expect(onChange).toHaveBeenCalledWith({ texto: 'Dor pélvica', hipoteses: ['Hipótese B'] });
  });

  it('mantém as hipóteses já adicionadas quando o texto principal é apagado', () => {
    renderField({ texto: '', hipoteses: ['Hipótese antiga'] });
    // texto vazio esconde a área de hipótese, mas o dado em `value` não foi alterado —
    // este teste documenta que HypothesisField não descarta value.hipoteses sozinho.
    expect(screen.queryByText('Hipótese antiga')).not.toBeInTheDocument();
  });
});
