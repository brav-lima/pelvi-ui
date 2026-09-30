import { BadRequestException } from '@nestjs/common';
import { AnamnesisType } from '@prisma/client';
import {
  ANAMNESIS_SECTIONS,
  extractSections,
  normalizeAnamnesisData,
} from './anamnesis-sections';

const GENERAL = AnamnesisType.PELVIC_GENERAL;
const PREGNANCY = AnamnesisType.PREGNANCY;

describe('ANAMNESIS_SECTIONS', () => {
  it('ficha pélvica geral tem exatamente as 11 seções da SOU-66', () => {
    expect(Object.keys(ANAMNESIS_SECTIONS[GENERAL])).toEqual([
      'identification',
      'chiefComplaint',
      'currentHistory',
      'healthHistory',
      'urinarySymptoms',
      'bowelSymptoms',
      'sexualSymptoms',
      'gynecologicalObstetricHistory',
      'behavioralHabits',
      'treatmentExpectations',
      'additionalNotes',
    ]);
  });

  it('ficha gestacional tem exatamente as 14 seções da SOU-66', () => {
    expect(Object.keys(ANAMNESIS_SECTIONS[PREGNANCY])).toEqual([
      'gestationalData',
      'obstetricHistory',
      'currentPregnancyHistory',
      'ultrasound',
      'otherExams',
      'healthHistory',
      'musculoskeletalPelvicSymptoms',
      'urinarySymptoms',
      'bowelSymptoms',
      'sexualSymptoms',
      'behavioralHabits',
      'birthPlanning',
      'physiotherapyGoals',
      'additionalNotes',
    ]);
  });
});

describe('normalizeAnamnesisData', () => {
  it('data ausente vira { sections: {} }', () => {
    expect(normalizeAnamnesisData(GENERAL, undefined)).toEqual({ sections: {} });
  });

  it('aceita seções narrativas vazias (campos clínicos nunca são obrigatórios)', () => {
    expect(
      normalizeAnamnesisData(GENERAL, { sections: { chiefComplaint: '', currentHistory: 'Há 2 meses' } }),
    ).toEqual({ sections: { chiefComplaint: '', currentHistory: 'Há 2 meses' } });
  });

  it('rejeita seção que não pertence ao tipo', () => {
    expect(() => normalizeAnamnesisData(GENERAL, { sections: { ultrasound: {} } })).toThrow(
      BadRequestException,
    );
    expect(() => normalizeAnamnesisData(PREGNANCY, { sections: { chiefComplaint: 'x' } })).toThrow(
      BadRequestException,
    );
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'rejeita id de seção "%s" (chave do protótipo de Object)',
    (id) => {
      const sections = JSON.parse(`{"${id}": "x"}`);
      expect(() => normalizeAnamnesisData(GENERAL, { sections })).toThrow(BadRequestException);
    },
  );

  it('rejeita chaves desconhecidas fora de sections', () => {
    expect(() => normalizeAnamnesisData(GENERAL, { sections: {}, other: 1 })).toThrow(
      BadRequestException,
    );
  });

  it('rejeita narrativa que não é string e string gigante', () => {
    expect(() => normalizeAnamnesisData(GENERAL, { sections: { chiefComplaint: 5 } })).toThrow(
      BadRequestException,
    );
    expect(() =>
      normalizeAnamnesisData(GENERAL, { sections: { chiefComplaint: 'x'.repeat(20001) } }),
    ).toThrow(BadRequestException);
  });

  it('seção estruturada precisa ser objeto simples', () => {
    expect(() => normalizeAnamnesisData(PREGNANCY, { sections: { ultrasound: 'texto' } })).toThrow(
      BadRequestException,
    );
    expect(() => normalizeAnamnesisData(PREGNANCY, { sections: { ultrasound: [] } })).toThrow(
      BadRequestException,
    );
  });

  describe('gestationalData', () => {
    const run = (gd: unknown) =>
      normalizeAnamnesisData(PREGNANCY, { sections: { gestationalData: gd } });

    it('aceita DUM/DPP válidas e risco obstétrico da lista', () => {
      expect(() =>
        run({ dum: '2026-01-01', dpp: '2026-10-08', obstetricRisk: 'ALTO_RISCO' }),
      ).not.toThrow();
    });

    it('aceita campos vazios/ausentes', () => {
      expect(() => run({ dum: '', obstetricRisk: '' })).not.toThrow();
      expect(() => run({})).not.toThrow();
    });

    it('rejeita data impossível (2026-02-30) e formato inválido', () => {
      expect(() => run({ dum: '2026-02-30' })).toThrow(BadRequestException);
      expect(() => run({ dpp: '10/10/2026' })).toThrow(BadRequestException);
    });

    it('rejeita risco obstétrico fora da lista', () => {
      expect(() => run({ obstetricRisk: 'MEDIO' })).toThrow(BadRequestException);
    });
  });
});

describe('extractSections', () => {
  it('lê sections de um data válido', () => {
    expect(extractSections({ sections: { a: 'b' } })).toEqual({ a: 'b' });
  });

  it.each([null, undefined, 'x', [], { sections: 'x' }, { queixaPrincipal: {} }])(
    'devolve {} para %j',
    (value) => {
      expect(extractSections(value)).toEqual({});
    },
  );
});
