import { IsDateString, IsEnum, IsObject, IsOptional } from 'class-validator';
import { AnamnesisStatus } from '@prisma/client';

export class UpdateAnamnesisDto {
  @IsOptional()
  @IsObject({ message: 'Dados da anamnese devem ser um objeto JSON' })
  data?: Record<string, unknown>;

  @IsOptional()
  @IsDateString({}, { message: 'Data da avaliação inválida' })
  assessmentDate?: string;

  @IsOptional()
  @IsEnum(AnamnesisStatus, { message: 'Status inválido' })
  status?: AnamnesisStatus;
}
