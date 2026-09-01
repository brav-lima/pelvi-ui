import { IsIn, IsOptional, IsInt, IsString, Min, IsISO8601, ValidateIf } from 'class-validator'

export class UpdateAccessDto {
  // Opcional: o pelvi-admin sincroniza planStatus/trialEndsAt sem re-afirmar
  // ACTIVE/BLOCKED a cada chamada (isso poderia desbloquear silenciosamente uma
  // clínica que um operador bloqueou manualmente).
  @IsOptional()
  @IsIn(['ACTIVE', 'BLOCKED'])
  status?: 'ACTIVE' | 'BLOCKED'

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
