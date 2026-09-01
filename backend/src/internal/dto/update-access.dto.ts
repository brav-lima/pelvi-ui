import { IsIn, IsNotEmpty, IsOptional, IsInt, IsString, Min, IsISO8601, ValidateIf } from 'class-validator'

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
  @IsString()
  plan?: string

  @IsOptional()
  @IsIn(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'])
  planStatus?: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'

  // aceita string ISO ou null explícito (limpa a data)
  @IsOptional()
  @ValidateIf((o) => o.trialEndsAt !== null)
  @IsISO8601()
  trialEndsAt?: string | null
}
