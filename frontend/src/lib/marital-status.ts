export const MARITAL_STATUS_OPTIONS = [
  { value: 'SINGLE', label: 'Solteiro(a)' },
  { value: 'MARRIED', label: 'Casado(a)' },
  { value: 'STABLE_UNION', label: 'União estável' },
  { value: 'DIVORCED', label: 'Divorciado(a)' },
  { value: 'WIDOWED', label: 'Viúvo(a)' },
  { value: 'OTHER', label: 'Outro' },
] as const;

export function maritalStatusLabel(value?: string | null): string | null {
  return MARITAL_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? null;
}

export function describeOccupationAndMaritalStatus(p: {
  occupation?: string | null;
  maritalStatus?: string | null;
}): string {
  return [p.occupation?.trim() || null, maritalStatusLabel(p.maritalStatus)]
    .filter(Boolean)
    .join(' · ');
}
