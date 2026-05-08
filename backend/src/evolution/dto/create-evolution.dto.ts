import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateEvolutionDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;

  @IsString({ message: 'Descrição é obrigatória' })
  @MinLength(1, { message: 'Descrição não pode ser vazia' })
  description: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID do agendamento inválido' })
  appointmentId?: string;
}
