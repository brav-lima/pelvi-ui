import { IsObject, IsOptional } from 'class-validator';

export class UpdateAnamnesisDto {
  @IsOptional()
  @IsObject({ message: 'Dados da anamnese devem ser um objeto JSON' })
  data?: Record<string, unknown>;
}
