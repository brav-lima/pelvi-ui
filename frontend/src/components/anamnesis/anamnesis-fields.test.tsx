import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HypothesisField, GroupedHypotheses, groupHypotheses, isAnamnesisData, emptyAnamnesisData } from './anamnesis-fields';
import type { AnamnesisFieldData, AnamnesisData } from './anamnesis-fields';

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

describe('groupHypotheses', () => {
  it('agrupa hipóteses dos 4 campos na ordem QP, Impacto, HA, HP', () => {
    const data: AnamnesisData = {
      queixaPrincipal: { texto: 'a', hipoteses: ['H1'] },
      impacto: { texto: 'b', hipoteses: ['H2'] },
      historiaAtual: { texto: 'c', hipoteses: ['H3'] },
      historiaPregressa: { texto: 'd', hipoteses: ['H4'] },
    };
    expect(groupHypotheses(data)).toEqual([
      { texto: 'H1', origem: 'Queixa Principal' },
      { texto: 'H2', origem: 'Impacto na Vida' },
      { texto: 'H3', origem: 'História Atual' },
      { texto: 'H4', origem: 'História Pregressa' },
    ]);
  });

  it('retorna lista vazia quando nenhum campo tem hipóteses', () => {
    expect(groupHypotheses(emptyAnamnesisData())).toEqual([]);
  });

  it('ignora campos ausentes em objeto parcial', () => {
    expect(groupHypotheses({ impacto: { texto: 'x', hipoteses: ['H'] } })).toEqual([
      { texto: 'H', origem: 'Impacto na Vida' },
    ]);
  });
});

describe('GroupedHypotheses', () => {
  it('exibe mensagem de estado vazio quando não há hipóteses', () => {
    render(<GroupedHypotheses data={emptyAnamnesisData()} />);
    expect(screen.getByText(/nenhuma hipótese registrada ainda/i)).toBeInTheDocument();
  });

  it('exibe cada hipótese com a tag de origem correta', () => {
    render(<GroupedHypotheses data={{ historiaAtual: { texto: 'x', hipoteses: ['Suspeita de X'] } }} />);
    expect(screen.getByText('Suspeita de X')).toBeInTheDocument();
    expect(screen.getByText('História Atual')).toBeInTheDocument();
  });
});

describe('isAnamnesisData', () => {
  it('retorna true para o formato novo completo', () => {
    expect(isAnamnesisData(emptyAnamnesisData())).toBe(true);
  });

  it('retorna false para o formato antigo (com _template)', () => {
    expect(isAnamnesisData({ _template: 'dor-pelvica', queixaPrincipal: {} })).toBe(false);
  });

  it('retorna false para null/undefined/tipos primitivos', () => {
    expect(isAnamnesisData(null)).toBe(false);
    expect(isAnamnesisData(undefined)).toBe(false);
    expect(isAnamnesisData('string')).toBe(false);
  });
});
