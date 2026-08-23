import { IsDateString, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class QueryAppointmentDto {
  @ValidateIf((o) => !o.patientId)
  @IsDateString({}, { message: 'Data de início inválida' })
  startDate?: string;

  @ValidateIf((o) => !o.patientId)
  @IsDateString({}, { message: 'Data de fim inválida' })
  endDate?: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID do profissional inválido' })
  professionalId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId?: string;
}
