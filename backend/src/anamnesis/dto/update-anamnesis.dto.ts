import { ValidateIf, IsDateString, IsEnum, IsObject, IsOptional } from 'class-validator';
import { AnamnesisStatus } from '@prisma/client';

export class UpdateAnamnesisDto {
  @ValidateIf((o) => o.data !== undefined)
  @IsObject({ message: 'Dados da anamnese devem ser um objeto JSON' })
  data?: Record<string, unknown>;

  @ValidateIf((o) => o.assessmentDate !== undefined)
  @IsDateString({}, { message: 'Data da avaliação inválida' })
  assessmentDate?: string;

  @ValidateIf((o) => o.status !== undefined)
  @IsEnum(AnamnesisStatus, { message: 'Status inválido' })
  status?: AnamnesisStatus;
}
