import { IsUUID } from 'class-validator';

export class SelectOrganizationDto {
  @IsUUID('4', { message: 'personId deve ser um UUID válido' })
  personId!: string;

  @IsUUID('4', { message: 'organizationId deve ser um UUID válido' })
  organizationId!: string;
}
