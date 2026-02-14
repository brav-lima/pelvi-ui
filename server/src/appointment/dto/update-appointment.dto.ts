import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID do profissional inválido' })
  professionalId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID do procedimento inválido' })
  procedureId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data/hora de início inválida' })
  startAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
