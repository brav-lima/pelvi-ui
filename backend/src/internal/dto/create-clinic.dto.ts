import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export enum DocumentType {
  CNPJ = 'CNPJ',
  CPF = 'CPF',
}

export class CreateClinicDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  document: string

  @IsEnum(DocumentType)
  @IsOptional()
  documentType?: DocumentType

  @IsEmail()
  email: string

  @IsString()
  @IsOptional()
  phone?: string
}
