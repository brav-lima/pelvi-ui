import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MARITAL_STATUSES, type MaritalStatus } from '../marital-status';

export class UpdatePatientDto {
  @IsOptional()
  @IsString({ message: 'Nome é obrigatório' })
  @MinLength(2, { message: 'Nome deve ter ao menos 2 caracteres' })
  name?: string;

  @IsOptional()
  @Matches(/^\d{11}$/, { message: 'CPF deve conter 11 dígitos numéricos' })
  cpf?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de nascimento inválida' })
  birthDate?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;

  @IsOptional()
  @IsIn(MARITAL_STATUSES, { message: 'Estado civil inválido' })
  maritalStatus?: MaritalStatus;

  @IsOptional()
  @IsString()
  addressCep?: string;

  @IsOptional()
  @IsString()
  addressStreet?: string;

  @IsOptional()
  @IsString()
  addressNumber?: string;

  @IsOptional()
  @IsString()
  addressComplement?: string;

  @IsOptional()
  @IsString()
  addressNeighborhood?: string;

  @IsOptional()
  @IsString()
  addressCity?: string;

  @IsOptional()
  @IsString()
  addressState?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
