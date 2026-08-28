import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAgendaBlockDto {
  @IsUUID('4', { message: 'ID do profissional inválido' })
  professionalId: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsDateString({}, { message: 'Data/hora de início inválida' })
  startAt: string;

  @IsDateString({}, { message: 'Data/hora de fim inválida' })
  endAt: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
