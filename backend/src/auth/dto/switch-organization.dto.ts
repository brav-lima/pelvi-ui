import { IsUUID } from 'class-validator';

export class SwitchOrganizationDto {
  @IsUUID('4', { message: 'organizationId deve ser um UUID válido' })
  organizationId!: string;
}
