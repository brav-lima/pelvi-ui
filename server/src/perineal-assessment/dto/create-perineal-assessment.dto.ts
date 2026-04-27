import { IsObject, IsUUID } from 'class-validator';

export class CreatePerinealAssessmentDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;

  @IsObject({ message: 'Dados da avaliação devem ser um objeto JSON' })
  data: Record<string, unknown>;
}
