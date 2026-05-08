import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class QueryAppointmentDto {
  @IsDateString({}, { message: 'Data de início inválida' })
  startDate: string;

  @IsDateString({}, { message: 'Data de fim inválida' })
  endDate: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID do profissional inválido' })
  professionalId?: string;
}
