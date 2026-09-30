import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { AnamnesisType, SensitiveLegalBasis } from '@prisma/client';

export class CreateAnamnesisDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;

  @IsEnum(AnamnesisType, { message: 'Tipo de anamnese inválido' })
  type: AnamnesisType;

  @IsOptional()
  @IsDateString({}, { message: 'Data da avaliação inválida' })
  assessmentDate?: string;

  @IsOptional()
  @IsObject({ message: 'Dados da anamnese devem ser um objeto JSON' })
  data?: Record<string, unknown>;

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
