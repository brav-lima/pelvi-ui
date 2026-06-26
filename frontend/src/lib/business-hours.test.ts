import { describe, it, expect } from 'vitest';
import { isSlotBlocked, getBusinessHourForDate, type BusinessHour } from './business-hours';

const monday = new Date('2026-06-22T00:00:00'); // segunda-feira
const sunday = new Date('2026-06-28T00:00:00'); // domingo

const bh: BusinessHour[] = [
  { day: 'MONDAY',    from: '08:00', to: '18:00', enabled: true },
  { day: 'TUESDAY',   from: '08:00', to: '18:00', enabled: true },
  { day: 'WEDNESDAY', from: '08:00', to: '18:00', enabled: true },
  { day: 'THURSDAY',  from: '08:00', to: '18:00', enabled: true },
  { day: 'FRIDAY',    from: '08:00', to: '17:00', enabled: true },
  { day: 'SATURDAY',  from: '09:00', to: '13:00', enabled: true },
  { day: 'SUNDAY',    from: null,    to: null,     enabled: false },
];

describe('getBusinessHourForDate', () => {
  it('retorna regra correta para segunda-feira', () => {
    const rule = getBusinessHourForDate(monday, bh);
    expect(rule?.day).toBe('MONDAY');
    expect(rule?.from).toBe('08:00');
  });

  it('retorna null quando bh é undefined', () => {
    expect(getBusinessHourForDate(monday, undefined)).toBeNull();
  });

  it('retorna null quando dia não está na lista', () => {
    expect(getBusinessHourForDate(monday, [])).toBeNull();
  });
});

describe('isSlotBlocked', () => {
  it('slot dentro do horário → não bloqueado', () => {
    expect(isSlotBlocked('10:00', monday, bh)).toBe(false);
    expect(isSlotBlocked('08:00', monday, bh)).toBe(false); // borda inicial incluída
    expect(isSlotBlocked('17:30', monday, bh)).toBe(false);
  });

  it('slot no limite final (to) → bloqueado (>=)', () => {
    expect(isSlotBlocked('18:00', monday, bh)).toBe(true);
  });

  it('slot antes do início → bloqueado', () => {
    expect(isSlotBlocked('07:30', monday, bh)).toBe(true);
    expect(isSlotBlocked('07:00', monday, bh)).toBe(true);
  });

  it('slot depois do fim → bloqueado', () => {
    expect(isSlotBlocked('18:30', monday, bh)).toBe(true);
    expect(isSlotBlocked('20:00', monday, bh)).toBe(true);
  });

  it('dia desabilitado (domingo) → sempre bloqueado', () => {
    expect(isSlotBlocked('10:00', sunday, bh)).toBe(true);
    expect(isSlotBlocked('00:00', sunday, bh)).toBe(true);
  });

  it('businessHours undefined → nunca bloqueado (fallback seguro)', () => {
    expect(isSlotBlocked('10:00', monday, undefined)).toBe(false);
    expect(isSlotBlocked('07:00', monday, undefined)).toBe(false);
  });

  it('businessHours vazio → nunca bloqueado', () => {
    expect(isSlotBlocked('10:00', monday, [])).toBe(false);
  });

  it('from/to null com dia enabled → nunca bloqueado', () => {
    const noTime: BusinessHour[] = [{ day: 'MONDAY', from: null, to: null, enabled: true }];
    expect(isSlotBlocked('10:00', monday, noTime)).toBe(false);
  });
});
