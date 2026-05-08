import { IsBoolean, IsEnum, IsOptional } from 'class-validator'
import { Role } from '@prisma/client'

export class UpdateClinicUserDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean

  @IsOptional()
  @IsEnum(Role, { message: 'Role deve ser ADMIN, PROFESSIONAL ou RECEPTIONIST' })
  role?: Role
}
