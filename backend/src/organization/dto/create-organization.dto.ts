import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
