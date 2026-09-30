import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupedHypotheses, groupHypotheses, isAnamnesisData } from './anamnesis-fields';
import type { AnamnesisData } from './anamnesis-fields';

const emptyAnamnesisData = (): AnamnesisData => ({
  queixaPrincipal: { texto: '', hipoteses: [] },
  impacto: { texto: '', hipoteses: [] },
  historiaAtual: { texto: '', hipoteses: [] },
  historiaPregressa: { texto: '', hipoteses: [] },
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
