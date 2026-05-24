import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { SensitiveLegalBasis } from '@prisma/client';

export class CreatePerinealAssessmentDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;

  @IsObject({ message: 'Dados da avaliação devem ser um objeto JSON' })
  data: Record<string, unknown>;

  @IsOptional()
  @IsEnum(SensitiveLegalBasis, { message: 'Base legal inválida' })
  legalBasis?: SensitiveLegalBasis;

  @IsOptional()
  @IsUUID('4', { message: 'ID do consentimento inválido' })
  consentId?: string;

  @IsOptional()
  @IsString()
  legalBasisNotes?: string;
}
