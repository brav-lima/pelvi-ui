import { Module } from '@nestjs/common';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';
import { PatientLookupService } from './patient-lookup.service';

@Module({
  controllers: [PatientController],
  providers: [PatientService, PatientLookupService],
  exports: [PatientLookupService],
})
export class PatientModule {}
