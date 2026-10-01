import { describe, it, expect } from 'vitest';
import {
  currentGestationalAge,
  dppFromDum,
  dppFromUltrasound,
  formatGestationalAge,
  formatGestationalAgeShort,
  formatIsoDate,
  gaFromDpp,
  gaFromDum,
  todayIso,
} from './gestational-age';

describe('dppFromDum', () => {
  it('soma 280 dias (regra de Naegele)', () => {
    expect(dppFromDum('2026-01-01')).toBe('2026-10-08');
  });
  it('atravessa ano bissexto', () => {
    expect(dppFromDum('2027-06-01')).toBe('2028-03-07');
  });
  it.each([undefined, '', '2026-02-30', '01/01/2026', 'abc'])('devolve null para %j', (v) => {
    expect(dppFromDum(v as string | undefined)).toBeNull();
  });
});

describe('gaFromDum', () => {
  it('calcula semanas + dias', () => {
    expect(gaFromDum('2026-01-01', '2026-06-10')).toEqual({ weeks: 22, days: 6 });
  });
  it('mesmo dia = 0s+0d', () => {
    expect(gaFromDum('2026-01-01', '2026-01-01')).toEqual({ weeks: 0, days: 0 });
  });
  it('referência anterior à DUM → null', () => {
    expect(gaFromDum('2026-06-10', '2026-01-01')).toBeNull();
  });
  it('mais de 45 semanas → null', () => {
    expect(gaFromDum('2026-01-01', '2026-12-31')).toBeNull();
  });
  it('data impossível → null', () => {
    expect(gaFromDum('2026-02-30', '2026-06-10')).toBeNull();
  });
});

describe('gaFromDpp', () => {
  it('é consistente com gaFromDum para a mesma gestação', () => {
    expect(gaFromDpp('2026-10-08', '2026-06-10')).toEqual({ weeks: 22, days: 6 });
  });
  it('na própria DPP = 40s+0d', () => {
    expect(gaFromDpp('2026-10-08', '2026-10-08')).toEqual({ weeks: 40, days: 0 });
  });
  it('referência muito anterior (GA negativa) → null', () => {
    expect(gaFromDpp('2026-10-08', '2025-01-01')).toBeNull();
  });
});

describe('dppFromUltrasound', () => {
  it('data do exame + (280 − IG no exame)', () => {
    expect(dppFromUltrasound('2026-06-10', { weeks: 22, days: 6 })).toBe('2026-10-08');
  });
  it.each([
    [{ weeks: 22, days: 7 }],
    [{ weeks: -1, days: 0 }],
    [{ weeks: 22.5, days: 0 }],
    [{ weeks: 60, days: 0 }],
  ])('IG inválida %j → null', (ga) => {
    expect(dppFromUltrasound('2026-06-10', ga)).toBeNull();
  });
  it('data do exame inválida ou ausente → null', () => {
    expect(dppFromUltrasound('2026-13-01', { weeks: 20, days: 0 })).toBeNull();
    expect(dppFromUltrasound(undefined, { weeks: 20, days: 0 })).toBeNull();
    expect(dppFromUltrasound('2026-06-10', undefined)).toBeNull();
  });
});

describe('currentGestationalAge', () => {
  it('a partir da DPP, recalculada para hoje', () => {
    expect(currentGestationalAge({ dpp: '2026-10-08', today: '2026-06-10' })).toEqual({
      weeks: 22,
      days: 6,
    });
  });
  it('IG manual avança pelos dias decorridos desde a avaliação', () => {
    expect(
      currentGestationalAge({
        manual: { weeks: 24, days: 0 },
        assessmentDate: '2026-06-01',
        today: '2026-06-10',
      }),
    ).toEqual({ weeks: 25, days: 2 });
  });
  it('IG manual tem prioridade sobre a DPP', () => {
    expect(
      currentGestationalAge({
        dpp: '2026-10-08',
        manual: { weeks: 30, days: 0 },
        assessmentDate: '2026-06-10',
        today: '2026-06-10',
      }),
    ).toEqual({ weeks: 30, days: 0 });
  });
  it('sem DPP nem IG manual → null', () => {
    expect(currentGestationalAge({ today: '2026-06-10' })).toBeNull();
  });
  it('IG manual inválida → null', () => {
    expect(
      currentGestationalAge({ manual: { weeks: 10, days: 9 }, assessmentDate: '2026-06-01', today: '2026-06-10' }),
    ).toBeNull();
  });
});

describe('formatação', () => {
  it('formatGestationalAge', () => {
    expect(formatGestationalAge({ weeks: 23, days: 4 })).toBe('23 semanas + 4 dias');
    expect(formatGestationalAge({ weeks: 1, days: 1 })).toBe('1 semana + 1 dia');
  });
  it('formatGestationalAgeShort', () => {
    expect(formatGestationalAgeShort({ weeks: 24, days: 3 })).toBe('24s + 3d');
  });
  it('formatIsoDate', () => {
    expect(formatIsoDate('2027-01-18')).toBe('18/01/2027');
    expect(formatIsoDate('xx')).toBe('');
    expect(formatIsoDate(undefined)).toBe('');
  });
  it('todayIso usa a data local, não UTC', () => {
    expect(todayIso(new Date(2026, 5, 10, 23, 30))).toBe('2026-06-10');
  });
});
