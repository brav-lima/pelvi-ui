import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { VoidingLeakageAmount } from '@prisma/client';

export class CreateVoidingDiaryEntryDto {
  @Type(() => Date)
  @IsDate({ message: 'Horário inválido' })
  recordedAt!: Date;

  @IsOptional()
  @IsInt()
  @Min(0)
  urineVolumeMl?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  voidingDurationSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fluidIntakeMl?: number;

  @IsBoolean()
  hadLeakage!: boolean;

  @ValidateIf((dto: CreateVoidingDiaryEntryDto) => dto.hadLeakage === true)
  @IsEnum(VoidingLeakageAmount, { message: 'Quantidade da perda inválida' })
  leakageAmount?: VoidingLeakageAmount;

  @IsBoolean()
  changedPad!: boolean;
}
