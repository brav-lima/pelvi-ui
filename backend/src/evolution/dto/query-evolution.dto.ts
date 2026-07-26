import { IsUUID } from 'class-validator';

export class QueryEvolutionDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;
}
