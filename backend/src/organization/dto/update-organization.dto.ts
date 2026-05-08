import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
