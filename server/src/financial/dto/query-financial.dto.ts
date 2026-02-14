import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryFinancialDto {
  @Type(() => Number)
  @IsInt({ message: 'Mês deve ser um número inteiro' })
  @Min(1)
  @Max(12)
  month: number;

  @Type(() => Number)
  @IsInt({ message: 'Ano deve ser um número inteiro' })
  @Min(2020)
  year: number;
}
