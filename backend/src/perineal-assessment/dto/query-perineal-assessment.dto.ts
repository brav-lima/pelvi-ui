import { IsUUID } from 'class-validator';

export class QueryPerinealAssessmentDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;
}
