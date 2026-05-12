import { IsString, IsUUID } from 'class-validator';

export class SelectOrganizationDto {
  @IsString({ message: 'preAuthToken é obrigatório' })
  preAuthToken!: string;

  @IsUUID('4', { message: 'organizationId deve ser um UUID válido' })
  organizationId!: string;
}
