import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { TaskPriority } from '@prisma/client';

export class CreateTaskDto {
  @IsString({ message: 'Título é obrigatório' })
  @MinLength(1, { message: 'Título não pode ser vazio' })
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Prioridade inválida' })
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString({}, { message: 'Data de prazo inválida' })
  dueDate?: string;

  @IsUUID('4', { message: 'ID do responsável inválido' })
  assignedToId: string;
}
