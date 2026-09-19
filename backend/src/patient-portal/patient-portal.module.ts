import { Module } from '@nestjs/common';
import { PatientAccountService } from './patient-account.service';

@Module({
  providers: [PatientAccountService],
})
export class PatientPortalModule {}
