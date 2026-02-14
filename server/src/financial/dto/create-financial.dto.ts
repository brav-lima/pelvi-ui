import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { FinancialType } from '@prisma/client';

export class CreateFinancialDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;

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
}
