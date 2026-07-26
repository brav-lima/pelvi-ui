import { IsUUID } from 'class-validator';

export class QueryAnamnesisDto {
  @IsUUID('4', { message: 'ID do paciente inválido' })
  patientId: string;
}
