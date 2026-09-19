import { Module } from '@nestjs/common';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';

@Module({
  providers: [PatientAccountService, PatientAccountLinkService],
})
export class PatientPortalModule {}
