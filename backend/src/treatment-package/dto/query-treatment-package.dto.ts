import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TreatmentPackageStatus } from '@prisma/client';

export class QueryTreatmentPackageDto {
  @IsOptional()
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId?: string;

  @IsOptional()
  @IsEnum(TreatmentPackageStatus, { message: 'Status inválido' })
  status?: TreatmentPackageStatus;
}
