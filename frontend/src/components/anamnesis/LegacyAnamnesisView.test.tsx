import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LegacyAnamnesisView } from './LegacyAnamnesisView';

describe('LegacyAnamnesisView', () => {
  it('renderiza o formato de 4 campos com hipóteses agrupadas e "Não informado"', () => {
    render(
      <LegacyAnamnesisView
        data={{
          queixaPrincipal: { texto: 'Dor pélvica', hipoteses: ['Hipótese A'] },
          impacto: { texto: '', hipoteses: [] },
          historiaAtual: { texto: '', hipoteses: [] },
          historiaPregressa: { texto: '', hipoteses: [] },
        }}
      />,
    );
    // label do campo + badge da hipótese agrupada
    expect(screen.getAllByText('Queixa Principal')).toHaveLength(2);
    expect(screen.getByText('Dor pélvica')).toBeInTheDocument();
    expect(screen.getAllByText('Não informado')).toHaveLength(3);
    expect(screen.getByText('Hipótese A')).toBeInTheDocument();
  });

  it('renderiza o formato antigo genérico e ignora _template', () => {
    render(
      <LegacyAnamnesisView
        data={{ _template: 'dor-pelvica', queixa: 'Dor lombar', historico: { fratura: ['2020'] } }}
      />,
    );
    expect(screen.getByText('Dor lombar')).toBeInTheDocument();
    expect(screen.getByText('2020')).toBeInTheDocument();
    expect(screen.queryByText(/dor-pelvica/)).not.toBeInTheDocument();
  });
});
