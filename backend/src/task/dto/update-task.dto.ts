import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Prioridade inválida' })
  priority?: TaskPriority;

  @IsOptional()
  @ValidateIf((o) => o.dueDate !== null)
  @IsDateString({}, { message: 'Data de prazo inválida' })
  dueDate?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'ID do responsável inválido' })
  assignedToId?: string;

  @IsOptional()
  @IsEnum(TaskStatus, { message: 'Status inválido' })
  status?: TaskStatus;
}
