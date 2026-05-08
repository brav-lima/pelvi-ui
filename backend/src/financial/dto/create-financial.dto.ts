import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { FinancialType } from '@prisma/client';

export class CreateFinancialDto {
  @IsOptional()
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID do agendamento inválido' })
  appointmentId?: string;

  @IsNumber({}, { message: 'Valor deve ser numérico' })
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  amount: number;

  @IsEnum(FinancialType, { message: 'Tipo deve ser INCOME ou EXPENSE' })
  type: FinancialType;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt({ message: 'Número de parcelas deve ser inteiro' })
  @Min(2, { message: 'Mínimo de 2 parcelas' })
  @Max(12, { message: 'Máximo de 12 parcelas' })
  installments?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento inválida' })
  dueDate?: string;
}
