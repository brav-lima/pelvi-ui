import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FinancialStatus } from '@prisma/client';

export class UpdateFinancialDto {
  @IsOptional()
  @IsNumber({}, { message: 'Valor deve ser numérico' })
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  amount?: number;

  @IsOptional()
  @IsEnum(FinancialStatus, { message: 'Status deve ser PENDING ou PAID' })
  status?: FinancialStatus;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
