import { IsIn, IsNotEmpty, IsOptional, IsInt, IsObject, Min } from 'class-validator'

export class UpdateAccessDto {
  @IsIn(['ACTIVE', 'BLOCKED'])
  @IsNotEmpty()
  status: 'ACTIVE' | 'BLOCKED'

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUsers?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  maxPatients?: number

  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>
}
