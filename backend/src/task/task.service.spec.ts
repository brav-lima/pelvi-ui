// backend/src/task/task.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { TaskService } from './task.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TaskService', () => {
  let service: TaskService;
  let prisma: { task: any; organizationUser: any };

  const orgId = 'org-1';
  const personId = 'person-1';
  const otherId = 'person-2';

  const mockCreator = { id: 'ou-1', active: true };
  const mockOther = { id: 'ou-2', active: true };

  const mockTask = {
    id: 'task-1',
    organizationId: orgId,
    title: 'Agendar manutenção',
    description: null,
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    dueDate: null,
    createdById: mockCreator.id,
    assignedToId: mockOther.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      task: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      organizationUser: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  describe('create', () => {
    it('deve criar tarefa com createdById resolvido via orgUser', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockCreator);
      prisma.task.create.mockResolvedValue({ ...mockTask, id: 'task-new' });

      await service.create(orgId, personId, {
        title: 'Agendar manutenção',
        assignedToId: mockOther.id,
      });

      expect(prisma.organizationUser.findUnique).toHaveBeenCalledWith({
        where: { organizationId_personId: { organizationId: orgId, personId } },
      });
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            title: 'Agendar manutenção',
            createdById: mockCreator.id,
            assignedToId: mockOther.id,
          }),
        }),
      );
    });

    it('deve lançar ForbiddenException quando orgUser não encontrado', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(null);

      await expect(
        service.create(orgId, personId, { title: 'Tarefa', assignedToId: 'ou-2' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('deve retornar tarefas da org sem filtros', async () => {
      prisma.task.findMany.mockResolvedValue([mockTask]);

      const result = await service.findAll(orgId);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: orgId } }),
      );
      expect(result).toHaveLength(1);
    });

    it('deve filtrar por status comma-separated', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      await service.findAll(orgId, 'PENDING,IN_PROGRESS');

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
          }),
        }),
      );
    });

    it('deve filtrar por priority e assignedToId', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      await service.findAll(orgId, undefined, 'HIGH', 'ou-2');

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: TaskPriority.HIGH,
            assignedToId: 'ou-2',
          }),
        }),
      );
    });
  });

  describe('findMy', () => {
    it('deve retornar tarefas atribuídas ao usuário com status padrão PENDING e IN_PROGRESS', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockCreator);
      prisma.task.findMany.mockResolvedValue([mockTask]);

      await service.findMy(orgId, personId);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            assignedToId: mockCreator.id,
            status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('deve atualizar status sem verificar criador (qualquer membro da org)', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.task.update.mockResolvedValue({ ...mockTask, status: TaskStatus.IN_PROGRESS });

      await service.update(orgId, otherId, 'task-1', { status: TaskStatus.IN_PROGRESS });

      expect(prisma.organizationUser.findUnique).not.toHaveBeenCalled();
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: TaskStatus.IN_PROGRESS }),
        }),
      );
    });

    it('deve atualizar campos de edição quando solicitante é o criador', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.organizationUser.findUnique.mockResolvedValue(mockCreator);
      prisma.task.update.mockResolvedValue({ ...mockTask, title: 'Novo título' });

      await service.update(orgId, personId, 'task-1', { title: 'Novo título' });

      expect(prisma.task.update).toHaveBeenCalled();
    });

    it('deve lançar ForbiddenException quando não-criador tenta editar campos', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.organizationUser.findUnique.mockResolvedValue(mockOther);

      await expect(
        service.update(orgId, otherId, 'task-1', { title: 'Hackeado' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve lançar NotFoundException quando tarefa não existe na org', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, personId, 'task-x', { status: TaskStatus.DONE }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deve excluir tarefa quando solicitante é o criador', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.organizationUser.findUnique.mockResolvedValue(mockCreator);
      prisma.task.delete.mockResolvedValue(mockTask);

      await service.remove(orgId, personId, 'task-1');

      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    });

    it('deve lançar ForbiddenException quando não-criador tenta excluir', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.organizationUser.findUnique.mockResolvedValue(mockOther);

      await expect(service.remove(orgId, otherId, 'task-1')).rejects.toThrow(ForbiddenException);
    });

    it('deve lançar NotFoundException quando tarefa não existe na org', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.remove(orgId, personId, 'task-x')).rejects.toThrow(NotFoundException);
    });
  });
});
