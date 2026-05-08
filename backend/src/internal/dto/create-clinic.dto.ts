import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateClinicDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  document: string

  @IsEmail()
  email: string

  @IsString()
  @IsOptional()
  phone?: string
}
