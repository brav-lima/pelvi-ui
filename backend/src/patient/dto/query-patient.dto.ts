import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryPatientDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['name_asc', 'name_desc'])
  orderBy?: 'name_asc' | 'name_desc';

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  hasActivePackage?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  hasNoUpcomingAppointment?: boolean;
}
