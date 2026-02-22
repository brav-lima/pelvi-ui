import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryFinancialDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Mês deve ser um número inteiro' })
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Ano deve ser um número inteiro' })
  @Min(2020)
  year?: number;

  /** ISO date string (YYYY-MM-DD). When provided together with endDate, filters by dueDate
   *  (or createdAt when dueDate is null) instead of the month/year window. */
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
