import { IsBoolean, IsEnum, IsObject, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateOrganizationUserDto {
  @IsOptional()
  @IsEnum(Role, { message: 'Role deve ser ADMIN, PROFESSIONAL ou RECEPTIONIST' })
  role?: Role;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
