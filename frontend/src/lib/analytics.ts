import posthog from 'posthog-js';

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

let initialized = false;

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    autocapture: false,
    disable_session_recording: true,
  });
  initialized = true;
}

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function identifyUser(
  personId: string,
  props: { role: string; organizationId: string },
): void {
  if (!initialized) return;
  posthog.identify(personId, { role: props.role });
  posthog.group('organization', props.organizationId);
}

export function resetUser(): void {
  if (!initialized) return;
  posthog.reset();
}
