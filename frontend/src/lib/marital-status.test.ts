import { describe, it, expect } from 'vitest';
import {
  MARITAL_STATUS_OPTIONS,
  describeOccupationAndMaritalStatus,
  maritalStatusLabel,
} from './marital-status';

describe('marital-status', () => {
  it('expõe as 6 opções esperadas', () => {
    expect(MARITAL_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      'SINGLE', 'MARRIED', 'STABLE_UNION', 'DIVORCED', 'WIDOWED', 'OTHER',
    ]);
  });

  it('maritalStatusLabel traduz e devolve null para vazio/desconhecido', () => {
    expect(maritalStatusLabel('STABLE_UNION')).toBe('União estável');
    expect(maritalStatusLabel('???')).toBeNull();
    expect(maritalStatusLabel(undefined)).toBeNull();
  });

  it('describeOccupationAndMaritalStatus junta os campos presentes', () => {
    expect(describeOccupationAndMaritalStatus({ occupation: 'Professora', maritalStatus: 'MARRIED' })).toBe(
      'Professora · Casado(a)',
    );
    expect(describeOccupationAndMaritalStatus({ occupation: 'Professora' })).toBe('Professora');
    expect(describeOccupationAndMaritalStatus({ maritalStatus: 'SINGLE' })).toBe('Solteiro(a)');
    expect(describeOccupationAndMaritalStatus({})).toBe('');
  });
});
