import { IsInt, IsNumber, IsString, Min, MinLength } from 'class-validator';

export class CreateProcedureDto {
  @IsString({ message: 'Nome é obrigatório' })
  @MinLength(2, { message: 'Nome deve ter ao menos 2 caracteres' })
  name: string;

  @IsInt({ message: 'Duração deve ser um número inteiro (minutos)' })
  @Min(1, { message: 'Duração mínima é 1 minuto' })
  durationMinutes: number;

  @IsNumber({}, { message: 'Valor deve ser numérico' })
  @Min(0, { message: 'Valor não pode ser negativo' })
  price: number;
}
