import { migrateData } from './migrate-anamnesis-fields';

describe('migrateData', () => {
  it('migrates a _template shape (new wizard) into the 4-field shape', () => {
    const templateFixture = {
      _template: 'dor-pelvica',
      queixaPrincipal: {
        motivo: 'Dor pélvica crônica',
        duracao: '6 meses',
      },
      impacto: {
        atividades: 'Parou de praticar exercícios',
      },
      molestiaAtual: {
        inicio: 'Início gradual após parto',
      },
      conclusao: {
        hipoteses: 'Disfunção do assoalho pélvico',
        observacoes: 'Encaminhar para fisioterapia',
      },
    };

    const result = migrateData(templateFixture);

    expect(Object.keys(result).sort()).toEqual(
      ['historiaAtual', 'historiaPregressa', 'impacto', 'queixaPrincipal'].sort(),
    );

    expect(result.queixaPrincipal.texto).toContain('Dor pélvica crônica');
    expect(result.impacto.texto).toContain('Parou de praticar exercícios');
    expect(result.historiaAtual.texto).toContain('Início gradual após parto');
    expect(result.historiaPregressa.texto).toContain('Encaminhar para fisioterapia');

    expect(result.historiaAtual.hipoteses).toContain('Disfunção do assoalho pélvico');
  });

  it('migrates the legacy AnamnesisFormDialog shape without mangling Title Case labels', () => {
    const legacyFixture = {
      'Queixa Principal': {
        'Motivo da Consulta': 'Dor lombar recorrente',
      },
      'Historico Medico': {
        'Doencas Preexistentes': 'Hipertensão controlada',
      },
      'Habitos de Vida': {
        'Atividade Fisica': 'Sedentário',
      },
      'Observacoes Gerais': 'Paciente colaborativo durante a avaliação',
    };

    const result = migrateData(legacyFixture);

    // Regression test: formatKey() must NOT be applied to already-human-readable
    // legacy labels. Applying it mangles them (leading space, doubled spaces,
    // lost capitalization) — this was a real bug found and fixed in an earlier
    // review round of this same script.
    expect(result.queixaPrincipal.texto).toContain('Motivo da Consulta: Dor lombar recorrente');
    expect(result.historiaPregressa.texto).toContain('Doencas Preexistentes: Hipertensão controlada');
    expect(result.historiaPregressa.texto).toContain('Atividade Fisica: Sedentário');
    expect(result.historiaPregressa.texto).toContain('Paciente colaborativo durante a avaliação');

    expect(result.historiaPregressa.texto).not.toContain(' doencas  preexistentes');
    expect(result.historiaPregressa.texto).not.toContain(' atividade  fisica');
  });
});
