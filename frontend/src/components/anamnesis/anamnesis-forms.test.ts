import { describe, it, expect } from 'vitest';
import { ANAMNESIS_FORMS, ANAMNESIS_TYPE_LABELS, asRecord, getSections } from './anamnesis-forms';

describe('ANAMNESIS_FORMS', () => {
  it('ids da ficha pélvica geral (mesma lista do backend)', () => {
    expect(ANAMNESIS_FORMS.PELVIC_GENERAL.map((s) => s.id)).toEqual([
      'identification', 'chiefComplaint', 'currentHistory', 'healthHistory', 'urinarySymptoms',
      'bowelSymptoms', 'sexualSymptoms', 'gynecologicalObstetricHistory', 'behavioralHabits',
      'treatmentExpectations', 'additionalNotes',
    ]);
  });

  it('ids da ficha gestacional (mesma lista do backend)', () => {
    expect(ANAMNESIS_FORMS.PREGNANCY.map((s) => s.id)).toEqual([
      'gestationalData', 'obstetricHistory', 'currentPregnancyHistory', 'ultrasound', 'otherExams',
      'healthHistory', 'musculoskeletalPelvicSymptoms', 'urinarySymptoms', 'bowelSymptoms',
      'sexualSymptoms', 'behavioralHabits', 'birthPlanning', 'physiotherapyGoals', 'additionalNotes',
    ]);
  });

  it.each(['PELVIC_GENERAL', 'PREGNANCY'] as const)('%s: ids únicos e toda narrativa tem placeholder', (type) => {
    const ids = ANAMNESIS_FORMS[type].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ANAMNESIS_FORMS[type]) {
      if (s.kind === 'narrative') expect(s.placeholder, s.id).toBeTruthy();
      else expect(s.component, s.id).toBeTruthy();
    }
  });

  it('orientação começa com "Investigar:" (exceto outros exames) e observações não têm orientação', () => {
    for (const type of ['PELVIC_GENERAL', 'PREGNANCY'] as const) {
      for (const s of ANAMNESIS_FORMS[type]) {
        if (s.id === 'additionalNotes') expect(s.guidance).toBeUndefined();
        else if (s.id === 'otherExams') expect(s.guidance).toMatch(/^Registrar exames/);
        else if (s.kind === 'narrative') expect(s.guidance, s.id).toMatch(/^Investigar: /);
      }
    }
  });

  it('usa os textos literais da SOU-66', () => {
    const chief = ANAMNESIS_FORMS.PELVIC_GENERAL.find((s) => s.id === 'chiefComplaint')!;
    expect(chief.title).toBe('Queixa principal');
    expect(chief.placeholder).toBe('Descreva a principal queixa relatada pela paciente...');
    const birth = ANAMNESIS_FORMS.PREGNANCY.find((s) => s.id === 'birthPlanning')!;
    expect(birth.title).toBe('Planejamento e expectativas para o parto');
  });

  it('rótulos dos tipos', () => {
    expect(ANAMNESIS_TYPE_LABELS.PELVIC_GENERAL).toBe('Anamnese Pélvica Geral');
    expect(ANAMNESIS_TYPE_LABELS.PREGNANCY).toBe('Anamnese Gestacional');
  });
});

describe('getSections / asRecord', () => {
  it('getSections lê data.sections e tolera formatos inesperados', () => {
    expect(getSections({ sections: { a: 'b' } })).toEqual({ a: 'b' });
    expect(getSections(null)).toEqual({});
    expect(getSections({ queixaPrincipal: {} })).toEqual({});
    expect(getSections({ sections: [] })).toEqual({});
  });
  it('asRecord', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord('x')).toEqual({});
    expect(asRecord([1])).toEqual({});
  });
});
