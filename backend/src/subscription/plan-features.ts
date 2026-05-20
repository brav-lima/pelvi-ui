// Feature keys known to pelvi-ui. The list of features allowed per plan
// is managed in pelvi-admin and fetched at runtime — not hardcoded here.
export type PlanFeature =
  | 'AGENDA'
  | 'PATIENTS'
  | 'FINANCIAL_BASIC'
  | 'FINANCIAL_ADVANCED'
  | 'PERINEAL_ASSESSMENT'
  | 'TREATMENT_PACKAGES'
  | 'ANAMNESIS'
  | 'EVOLUTIONS'
  | 'ROLES'
  | 'MULTI_PROFESSIONAL'
  | 'MULTI_CLINIC'
  | 'PRIORITY_SUPPORT';
