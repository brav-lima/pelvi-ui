import { Module } from '@nestjs/common';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';

@Module({
  providers: [PatientAccountService, PatientAccountLinkService, PatientConsentAuditService],
})
export class PatientPortalModule {}
