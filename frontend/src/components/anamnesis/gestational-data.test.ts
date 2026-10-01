import { describe, it, expect } from 'vitest';
import {
  applyCalculatedDpp,
  asGestationalData,
  asUltrasound,
  calculatedDpp,
  changeGaSource,
  editDpp,
  recomputeGestational,
  setManualGa,
} from './gestational-data';

const ctx = { assessmentDate: '2026-06-10' };

describe('recomputeGestational — fonte DUM (padrão)', () => {
  it('DUM informada → DPP = DUM + 280 dias e IG na data da avaliação', () => {
    const out = recomputeGestational({ dum: '2026-01-01' }, ctx);
    expect(out.dpp).toBe('2026-10-08');
    expect(out.dppSource).toBe('DUM');
    expect(out.gestationalAge).toEqual({ weeks: 22, days: 6, manualOverride: false });
  });

  it('DUM apagada remove DPP e IG calculadas', () => {
    const first = recomputeGestational({ dum: '2026-01-01' }, ctx);
    const out = recomputeGestational({ ...first, dum: '' }, ctx);
    expect(out.dpp).toBeUndefined();
    expect(out.dppSource).toBeUndefined();
    expect(out.gestationalAge).toBeUndefined();
  });

  it('DUM impossível não produz DPP nem IG', () => {
    const out = recomputeGestational({ dum: '2026-02-30' }, ctx);
    expect(out.dpp).toBeUndefined();
    expect(out.gestationalAge).toBeUndefined();
  });

  it('DPP digitada à mão não é sobrescrita ao mudar a DUM', () => {
    const edited = editDpp({ dum: '2026-01-01' }, '2026-10-20', ctx);
    expect(edited.dppSource).toBe('MANUAL');
    const out = recomputeGestational({ ...edited, dum: '2026-01-05' }, ctx);
    expect(out.dpp).toBe('2026-10-20');
    expect(out.dppSource).toBe('MANUAL');
  });

  it('applyCalculatedDpp descarta a DPP manual e volta a calcular', () => {
    const edited = editDpp({ dum: '2026-01-01' }, '2026-10-20', ctx);
    const out = applyCalculatedDpp(edited, ctx);
    expect(out.dpp).toBe('2026-10-08');
    expect(out.dppSource).toBe('DUM');
  });

  it('é idempotente', () => {
    const once = recomputeGestational({ dum: '2026-01-01' }, ctx);
    expect(recomputeGestational(once, ctx)).toEqual(once);
  });
});

describe('recomputeGestational — fonte ultrassonografia', () => {
  const us = { date: '2026-06-10', gaAtExam: { weeks: 22, days: 6 } };

  it('DPP vem do exame e a IG é derivada dela', () => {
    const data = changeGaSource({ dum: '2026-01-15' }, 'ULTRASSONOGRAFIA', { ...ctx, ultrasound: us });
    expect(data.gaSource).toBe('ULTRASSONOGRAFIA');
    expect(data.dpp).toBe('2026-10-08');
    expect(data.dppSource).toBe('ULTRASSONOGRAFIA');
    expect(data.gestationalAge).toEqual({ weeks: 22, days: 6, manualOverride: false });
  });

  it('sem dados de ultrassonografia não inventa DPP', () => {
    const data = changeGaSource({ dum: '2026-01-15' }, 'ULTRASSONOGRAFIA', ctx);
    expect(data.dpp).toBeUndefined();
    expect(data.gestationalAge).toBeUndefined();
  });

  it('calculatedDpp reflete a fonte ativa', () => {
    expect(calculatedDpp({ gaSource: 'ULTRASSONOGRAFIA' }, { ...ctx, ultrasound: us })).toBe('2026-10-08');
    expect(calculatedDpp({ dum: '2026-01-01' }, ctx)).toBe('2026-10-08');
    expect(calculatedDpp({ gaSource: 'MANUAL', dum: '2026-01-01' }, ctx)).toBeNull();
  });
});

describe('fonte manual', () => {
  it('setManualGa marca override e recompute não sobrescreve', () => {
    const manual = setManualGa({ dum: '2026-01-01' }, 30, 2);
    expect(manual.gaSource).toBe('MANUAL');
    expect(manual.gestationalAge).toEqual({ weeks: 30, days: 2, manualOverride: true });
    expect(recomputeGestational(manual, ctx)).toEqual(manual);
  });

  it('trocar para MANUAL preserva o último valor calculado como ponto de partida', () => {
    const calc = recomputeGestational({ dum: '2026-01-01' }, ctx);
    const out = changeGaSource(calc, 'MANUAL', ctx);
    expect(out.gaSource).toBe('MANUAL');
    expect(out.gestationalAge).toEqual({ weeks: 22, days: 6, manualOverride: true });
  });

  it('voltar de MANUAL para DUM recalcula (escolha explícita da profissional)', () => {
    const manual = setManualGa({ dum: '2026-01-01' }, 30, 2);
    const out = changeGaSource(manual, 'DUM', ctx);
    expect(out.gestationalAge).toEqual({ weeks: 22, days: 6, manualOverride: false });
  });
});

describe('asGestationalData / asUltrasound', () => {
  it('toleram valores não-objeto', () => {
    expect(asGestationalData(undefined)).toEqual({});
    expect(asGestationalData('x')).toEqual({});
    expect(asUltrasound(null)).toEqual({});
    expect(asUltrasound({ date: '2026-06-10' })).toEqual({ date: '2026-06-10' });
  });
});
