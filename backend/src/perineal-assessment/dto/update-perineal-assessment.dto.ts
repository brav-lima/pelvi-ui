import { IsObject, IsOptional } from 'class-validator';

export class UpdatePerinealAssessmentDto {
  @IsOptional()
  @IsObject({ message: 'Dados da avaliação devem ser um objeto JSON' })
  data?: Record<string, unknown>;
}
