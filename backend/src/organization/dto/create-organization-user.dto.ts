import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateOrganizationUserDto {
  @IsUUID('4', { message: 'personId deve ser um UUID válido' })
  personId!: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Role deve ser ADMIN, PROFESSIONAL ou RECEPTIONIST' })
  role?: Role;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>;
}
