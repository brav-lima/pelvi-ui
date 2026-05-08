import { describe, it, expect } from 'vitest';
import {
  maskCPF,
  maskPhone,
  maskCurrency,
  parseCurrency,
  formatCPF,
  formatCPFMasked,
  formatCNPJ,
  formatPhone,
  formatCurrency,
} from '@/lib/formatters';

// ── maskCPF ──────────────────────────────────────────────────────────────────

describe('maskCPF', () => {
  it('formats CPF progressively as digits are typed', () => {
    expect(maskCPF('1')).toBe('1');
    expect(maskCPF('123')).toBe('123');
    expect(maskCPF('1234')).toBe('123.4');
    expect(maskCPF('123456')).toBe('123.456');
    expect(maskCPF('1234567')).toBe('123.456.7');
    expect(maskCPF('123456789')).toBe('123.456.789');
    expect(maskCPF('12345678901')).toBe('123.456.789-01');
  });

  it('strips non-digit characters', () => {
    expect(maskCPF('111.111.111-11')).toBe('111.111.111-11');
    expect(maskCPF('abc 111 def 111 ghi 111 jk 11')).toBe('111.111.111-11');
  });

  it('caps at 11 digits ignoring extras', () => {
    expect(maskCPF('123456789012345')).toBe('123.456.789-01');
  });
});

// ── maskPhone ─────────────────────────────────────────────────────────────────

describe('maskPhone', () => {
  it('formats 11-digit celular', () => {
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('formats 10-digit fixo', () => {
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444');
  });

  it('handles partial input', () => {
    expect(maskPhone('11')).toBe('(11');
    expect(maskPhone('119')).toBe('(11) 9');
    expect(maskPhone('11987')).toBe('(11) 987');
  });

  it('strips non-digits', () => {
    expect(maskPhone('(11) 98765-4321')).toBe('(11) 98765-4321');
  });
});

// ── maskCurrency ──────────────────────────────────────────────────────────────

describe('maskCurrency', () => {
  it('adds thousand separator', () => {
    expect(maskCurrency('1234')).toBe('1.234');
    expect(maskCurrency('1000000')).toBe('1.000.000');
  });

  it('preserves decimal part up to 2 places', () => {
    expect(maskCurrency('100,50')).toBe('100,50');
    expect(maskCurrency('1234,56')).toBe('1.234,56');
  });

  it('truncates decimal to 2 digits', () => {
    expect(maskCurrency('100,999')).toBe('100,99');
  });

  it('handles empty string', () => {
    expect(maskCurrency('')).toBe('');
  });
});

// ── parseCurrency ─────────────────────────────────────────────────────────────

describe('parseCurrency', () => {
  it('parses masked pt-BR value to number', () => {
    expect(parseCurrency('1.234,56')).toBe(1234.56);
    expect(parseCurrency('100,00')).toBe(100);
    expect(parseCurrency('0,50')).toBe(0.5);
  });

  it('returns 0 for empty or invalid input', () => {
    expect(parseCurrency('')).toBe(0);
    expect(parseCurrency('abc')).toBe(0);
  });

  it('round-trips with maskCurrency', () => {
    expect(parseCurrency(maskCurrency('150,75'))).toBe(150.75);
  });
});

// ── formatCPF ─────────────────────────────────────────────────────────────────

describe('formatCPF', () => {
  it('formats 11 raw digits', () => {
    expect(formatCPF('11111111111')).toBe('111.111.111-11');
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
  });

  it('returns empty string for falsy values', () => {
    expect(formatCPF('')).toBe('');
    expect(formatCPF(null)).toBe('');
    expect(formatCPF(undefined)).toBe('');
  });

  it('returns value as-is when not 11 digits', () => {
    expect(formatCPF('123')).toBe('123');
    expect(formatCPF('1234567890123')).toBe('1234567890123');
  });
});

// ── formatCPFMasked ───────────────────────────────────────────────────────────

describe('formatCPFMasked', () => {
  it('masks first 3 and last 2 digits', () => {
    expect(formatCPFMasked('11111111111')).toBe('***.111.111-**');
  });

  it('returns empty string for falsy values', () => {
    expect(formatCPFMasked(null)).toBe('');
    expect(formatCPFMasked(undefined)).toBe('');
  });
});

// ── formatCNPJ ────────────────────────────────────────────────────────────────

describe('formatCNPJ', () => {
  it('formats 14 raw digits', () => {
    expect(formatCNPJ('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('returns empty string for falsy values', () => {
    expect(formatCNPJ(null)).toBe('');
    expect(formatCNPJ(undefined)).toBe('');
    expect(formatCNPJ('')).toBe('');
  });

  it('returns value as-is when not 14 digits', () => {
    expect(formatCNPJ('123')).toBe('123');
  });
});

// ── formatPhone ───────────────────────────────────────────────────────────────

describe('formatPhone', () => {
  it('formats 11-digit celular', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('formats 10-digit fixo', () => {
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
  });

  it('returns empty string for falsy values', () => {
    expect(formatPhone(null)).toBe('');
    expect(formatPhone(undefined)).toBe('');
    expect(formatPhone('')).toBe('');
  });

  it('returns value as-is for unrecognized length', () => {
    expect(formatPhone('119876')).toBe('119876');
  });
});

// ── formatCurrency ────────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats number to pt-BR decimal notation', () => {
    expect(formatCurrency(1234.56)).toBe('1.234,56');
    expect(formatCurrency(100)).toBe('100,00');
    expect(formatCurrency(0)).toBe('0,00');
    expect(formatCurrency(0.5)).toBe('0,50');
  });

  it('handles null and undefined as 0', () => {
    expect(formatCurrency(null)).toBe('0,00');
    expect(formatCurrency(undefined)).toBe('0,00');
  });

  it('parses string input', () => {
    expect(formatCurrency('150.5')).toBe('150,50');
    expect(formatCurrency('1000')).toBe('1.000,00');
  });
});
