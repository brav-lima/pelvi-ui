import { SetMetadata } from '@nestjs/common';
import type { PatientTreatmentPlanFeatures } from '../patient-treatment-plan.service';

export const REQUIRE_PATIENT_TREATMENT_PLAN_FEATURE = 'requirePatientTreatmentPlanFeature';
export const RequirePatientTreatmentPlanFeature = (feature: keyof PatientTreatmentPlanFeatures) =>
  SetMetadata(REQUIRE_PATIENT_TREATMENT_PLAN_FEATURE, feature);
