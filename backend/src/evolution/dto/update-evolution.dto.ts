import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateEvolutionDto {
  @IsOptional()
  @IsString({ message: 'Descrição inválida' })
  @MinLength(1, { message: 'Descrição não pode ser vazia' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data da evolução inválida' })
  evolutionDate?: string;

  // null = desvincular agendamento; undefined = não alterar
  @IsOptional()
  @IsUUID('4', { message: 'ID do agendamento inválido' })
  appointmentId?: string | null;
}
