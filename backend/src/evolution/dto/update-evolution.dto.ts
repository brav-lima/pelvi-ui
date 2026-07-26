import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateEvolutionDto {
  @IsOptional()
  @IsString({ message: 'Descrição inválida' })
  @MinLength(1, { message: 'Descrição não pode ser vazia' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data da evolução inválida' })
  evolutionDate?: string;
}
