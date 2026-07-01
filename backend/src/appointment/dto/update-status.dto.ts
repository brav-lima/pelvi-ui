import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(AppointmentStatus, { message: 'Status inválido' })
  status: AppointmentStatus;

  @IsOptional()
  @IsBoolean()
  deductFromPackage?: boolean;
}
