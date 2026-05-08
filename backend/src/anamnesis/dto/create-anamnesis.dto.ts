import { IsObject, IsUUID } from 'class-validator';

export class CreateAnamnesisDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;

  @IsObject({ message: 'Dados da anamnese devem ser um objeto JSON' })
  data: Record<string, unknown>;
}
