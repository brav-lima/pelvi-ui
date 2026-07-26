export enum AnalyticsEvent {
  PatientCreated = 'patient_created',
  AppointmentCreated = 'appointment_created',
  AppointmentCanceled = 'appointment_canceled',
  ProcedureCreated = 'procedure_created',
  FinancialRecordCreated = 'financial_record_created',
  FinancialRecordPaid = 'financial_record_paid',
  TreatmentPackageCreated = 'treatment_package_created',
  EvolutionCreated = 'evolution_created',
  PerinealAssessmentCreated = 'perineal_assessment_created',
  Login = 'login',
}

export function initAnalytics(): void {
  // no-op: PostHog removed
}

export function track(_event: AnalyticsEvent, _properties?: Record<string, unknown>): void {
  // no-op: PostHog removed
}

export function identifyUser(
  _personId: string,
  _props: { role: string; organizationId: string },
): void {
  // no-op: PostHog removed
}

export function resetUser(): void {
  // no-op: PostHog removed
}
