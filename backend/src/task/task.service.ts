// backend/src/task/task.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const taskIncludes = {
  createdBy: { include: { person: { select: { id: true, name: true } } } },
  assignedTo: { include: { person: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  async create(orgId: string, personId: string, dto: CreateTaskDto) {
    const orgUser = await this.resolveOrgUser(orgId, personId);

    return this.prisma.task.create({
      data: {
        organizationId: orgId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        createdById: orgUser.id,
        assignedToId: dto.assignedToId,
      },
      include: taskIncludes,
    });
  }

  async findAll(
    orgId: string,
    status?: string,
    priority?: string,
    assignedToId?: string,
  ) {
    const statusFilter = status
      ? { in: status.split(',') as TaskStatus[] }
      : undefined;

    const validPriority = priority && (Object.values(TaskPriority) as string[]).includes(priority)
      ? (priority as TaskPriority)
      : undefined;

    return this.prisma.task.findMany({
      where: {
        organizationId: orgId,
        ...(statusFilter && { status: statusFilter }),
        ...(validPriority && { priority: validPriority }),
        ...(assignedToId && { assignedToId }),
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: taskIncludes,
    });
  }

  async findMy(orgId: string, personId: string, status?: string) {
    const orgUser = await this.resolveOrgUser(orgId, personId);

    const statusFilter = status
      ? { in: status.split(',') as TaskStatus[] }
      : { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] };

    return this.prisma.task.findMany({
      where: {
        organizationId: orgId,
        assignedToId: orgUser.id,
        status: statusFilter,
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: taskIncludes,
    });
  }

  async update(orgId: string, personId: string, id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada');

    const { status, ...editFields } = dto;
    const hasEditFields = Object.values(editFields).some((v) => v !== undefined);

    if (hasEditFields) {
      const orgUser = await this.resolveOrgUser(orgId, personId);
      if (task.createdById !== orgUser.id) {
        throw new ForbiddenException('Apenas o criador pode editar esta tarefa');
      }
    }

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (editFields.title !== undefined) data.title = editFields.title;
    if (editFields.description !== undefined) data.description = editFields.description ?? null;
    if (editFields.priority !== undefined) data.priority = editFields.priority;
    if (editFields.dueDate !== undefined) data.dueDate = editFields.dueDate ? new Date(editFields.dueDate) : null;
    if (editFields.assignedToId !== undefined) data.assignedToId = editFields.assignedToId;

    return this.prisma.task.update({
      where: { id },
      data,
      include: taskIncludes,
    });
  }

  async remove(orgId: string, personId: string, id: string): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada');

    const orgUser = await this.resolveOrgUser(orgId, personId);
    if (task.createdById !== orgUser.id) {
      throw new ForbiddenException('Apenas o criador pode excluir esta tarefa');
    }

    await this.prisma.task.delete({ where: { id } });
  }

  private async resolveOrgUser(organizationId: string, personId: string) {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_personId: { organizationId, personId },
      },
    });

    if (!orgUser || !orgUser.active) {
      throw new ForbiddenException('Vínculo com a clínica não encontrado');
    }

    return orgUser;
  }
}
