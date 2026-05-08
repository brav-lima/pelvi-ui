import { IsIn, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator'

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
}
