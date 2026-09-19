import { Type } from 'class-transformer';
import { IsBoolean, ValidateNested } from 'class-validator';

class PatientTreatmentPlanFeaturesDto {
  @IsBoolean()
  diarioMiccional!: boolean;

  @IsBoolean()
  diarioEvacuatorio!: boolean;

  @IsBoolean()
  cronometros!: boolean;
}

export class UpdatePatientTreatmentPlanDto {
  @ValidateNested()
  @Type(() => PatientTreatmentPlanFeaturesDto)
  features!: PatientTreatmentPlanFeaturesDto;
}
