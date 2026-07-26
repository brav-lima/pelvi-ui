import { IsOptional, IsUUID } from 'class-validator';

export class QueryTreatmentPackageDto {
  @IsOptional()
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId?: string;
}
