import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TreatmentPackageStatus } from '@prisma/client';

export class UpdateTreatmentPackageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(TreatmentPackageStatus, {
    message: 'Status deve ser ACTIVE, COMPLETED ou CANCELED',
  })
  status?: TreatmentPackageStatus;
}
