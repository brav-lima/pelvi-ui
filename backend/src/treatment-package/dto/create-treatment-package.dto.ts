import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CustomInstallmentDto {
  @IsNumber({}, { message: 'Valor da parcela deve ser numérico' })
  @Min(0.01, { message: 'Valor da parcela deve ser maior que zero' })
  amount: number;

  @IsDateString({}, { message: 'Data de vencimento inválida' })
  dueDate: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class CreateTreatmentPackageDto {
  @IsString({ message: 'Nome é obrigatório' })
  name: string;

  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;

  @IsArray({ message: 'Procedimentos devem ser um array' })
  @IsUUID('4', { each: true, message: 'ID de procedimento inválido' })
  procedureIds: string[];

  @IsInt({ message: 'Total de sessões deve ser inteiro' })
  @Min(1, { message: 'Mínimo de 1 sessão' })
  totalSessions: number;

  @IsNumber({}, { message: 'Valor deve ser numérico' })
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  totalPrice: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsInt({ message: 'Número de parcelas deve ser inteiro' })
  @Min(1, { message: 'Mínimo de 1 parcela' })
  @Max(24, { message: 'Máximo de 24 parcelas' })
  installments?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento inválida' })
  dueDate?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Valor da entrada deve ser numérico' })
  @Min(0.01, { message: 'Valor da entrada deve ser maior que zero' })
  downPayment?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento da entrada inválida' })
  downPaymentDueDate?: string;

  @IsOptional()
  @IsArray({ message: 'Parcelas devem ser um array' })
  @ValidateNested({ each: true })
  @Type(() => CustomInstallmentDto)
  customInstallments?: CustomInstallmentDto[];
}
