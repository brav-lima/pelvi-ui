import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FULL_PATIENT_SESSION = 'requireFullPatientSession';
export const RequireFullPatientSession = () => SetMetadata(REQUIRE_FULL_PATIENT_SESSION, true);
