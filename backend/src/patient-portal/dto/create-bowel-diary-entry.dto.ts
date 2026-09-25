import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsIn, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import { BowelEffort, BowelSensation, BowelLeakageType } from '@prisma/client';

const BRISTOL_STOOL_TYPES = ['1', '2', '3', '4', '5', '6', '7'] as const;

export class CreateBowelDiaryEntryDto {
  @Type(() => Date)
  @IsDate({ message: 'Horário inválido' })
  recordedAt!: Date;

  @IsBoolean()
  hadBowelMovement!: boolean;

  @IsOptional()
  @IsIn(BRISTOL_STOOL_TYPES, { message: 'Tipo de fezes inválido' })
  bristolType?: string;

  @IsOptional()
  @IsEnum(BowelEffort, { message: 'Esforço inválido' })
  effort?: BowelEffort;

  @IsOptional()
  @IsEnum(BowelSensation, { message: 'Sensação inválida' })
  sensation?: BowelSensation;

  @IsOptional()
  @IsInt()
  @Min(0)
  bowelMovementDurationSeconds?: number;

  @IsBoolean()
  hadLeakage!: boolean;

  @ValidateIf((dto: CreateBowelDiaryEntryDto) => dto.hadLeakage === true)
  @IsEnum(BowelLeakageType, { message: 'Tipo de perda inválido' })
  leakageType?: BowelLeakageType;
}
