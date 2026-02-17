import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;

  @IsUUID('4', { message: 'ID do profissional inválido' })
  professionalId: string;

  @IsUUID('4', { message: 'ID do procedimento inválido' })
  procedureId: string;

  @IsDateString({}, { message: 'Data/hora de início inválida' })
  startAt: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID do pacote de tratamento inválido' })
  treatmentPackageId?: string;
}
