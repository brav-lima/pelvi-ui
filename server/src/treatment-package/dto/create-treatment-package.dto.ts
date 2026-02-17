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
} from 'class-validator';

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
  @Max(12, { message: 'Máximo de 12 parcelas' })
  installments?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento inválida' })
  dueDate?: string;
}
