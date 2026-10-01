export const MARITAL_STATUSES = [
  'SINGLE',
  'MARRIED',
  'STABLE_UNION',
  'DIVORCED',
  'WIDOWED',
  'OTHER',
] as const;

export type MaritalStatus = (typeof MARITAL_STATUSES)[number];
