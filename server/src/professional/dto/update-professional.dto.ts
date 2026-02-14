import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateProfessionalDto {
  @IsOptional()
  @IsEnum(Role, { message: 'Perfil inválido' })
  role?: Role;

  @IsOptional()
  @IsBoolean({ message: 'Campo ativo deve ser boolean' })
  active?: boolean;
}
