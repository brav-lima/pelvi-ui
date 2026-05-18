import { IsUUID } from 'class-validator';

export class ChangePlanDto {
  @IsUUID('4', { message: 'ID do plano inválido' })
  planId: string;
}
