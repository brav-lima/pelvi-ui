import { IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryTaskDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID do responsável inválido' })
  assignedToId?: string;
}
