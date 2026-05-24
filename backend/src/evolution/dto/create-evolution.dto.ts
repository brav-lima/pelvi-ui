import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { SensitiveLegalBasis } from '@prisma/client';

export class CreateEvolutionDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;

  @IsString({ message: 'Descrição é obrigatória' })
  @MinLength(1, { message: 'Descrição não pode ser vazia' })
  description: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID do agendamento inválido' })
  appointmentId?: string;

  @IsOptional()
  @IsEnum(SensitiveLegalBasis, { message: 'Base legal inválida' })
  legalBasis?: SensitiveLegalBasis;

  @IsOptional()
  @IsUUID('4', { message: 'ID do consentimento inválido' })
  consentId?: string;
}
