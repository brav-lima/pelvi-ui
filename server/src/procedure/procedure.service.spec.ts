import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProcedureService } from './procedure.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProcedureService', () => {
  let service: ProcedureService;
  let prisma: { procedure: any };

  const orgId = 'org-1';

  beforeEach(async () => {
    prisma = {
      procedure: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcedureService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProcedureService>(ProcedureService);
  });

  describe('create', () => {
    it('deve criar procedimento vinculado à organização', async () => {
      const dto = { name: 'Fisioterapia', durationMinutes: 60, price: 150 };
      const created = { id: 'proc-1', organizationId: orgId, ...dto };
      prisma.procedure.create.mockResolvedValue(created);

      const result = await service.create(orgId, dto);

      expect(prisma.procedure.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ organizationId: orgId, ...dto }),
      });
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('deve listar apenas procedimentos da organização, ordenados por nome', async () => {
      prisma.procedure.findMany.mockResolvedValue([]);

      await service.findAll(orgId);

      expect(prisma.procedure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId },
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  describe('findById', () => {
    it('deve retornar o procedimento quando pertence à organização', async () => {
      const proc = { id: 'proc-1', organizationId: orgId, name: 'Fisioterapia' };
      prisma.procedure.findFirst.mockResolvedValue(proc);

      const result = await service.findById(orgId, 'proc-1');

      expect(prisma.procedure.findFirst).toHaveBeenCalledWith({
        where: { id: 'proc-1', organizationId: orgId },
      });
      expect(result).toEqual(proc);
    });

    it('deve lançar NotFoundException quando não encontrado ou de outra organização', async () => {
      prisma.procedure.findFirst.mockResolvedValue(null);

      await expect(service.findById(orgId, 'proc-outro')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('deve atualizar quando o procedimento pertence à organização', async () => {
      const existing = { id: 'proc-1', organizationId: orgId, name: 'Fisioterapia' };
      const updated = { ...existing, name: 'Pilates' };
      prisma.procedure.findFirst.mockResolvedValue(existing);
      prisma.procedure.update.mockResolvedValue(updated);

      const result = await service.update(orgId, 'proc-1', { name: 'Pilates' });

      expect(prisma.procedure.update).toHaveBeenCalledWith({
        where: { id: 'proc-1' },
        data: { name: 'Pilates' },
      });
      expect(result).toEqual(updated);
    });

    it('deve lançar NotFoundException antes de atualizar quando procedimento não existe na org', async () => {
      prisma.procedure.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, 'proc-inexistente', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.procedure.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deve deletar quando o procedimento pertence à organização', async () => {
      const existing = { id: 'proc-1', organizationId: orgId };
      prisma.procedure.findFirst.mockResolvedValue(existing);
      prisma.procedure.delete.mockResolvedValue(existing);

      await service.remove(orgId, 'proc-1');

      expect(prisma.procedure.delete).toHaveBeenCalledWith({
        where: { id: 'proc-1' },
      });
    });

    it('deve lançar NotFoundException antes de deletar quando procedimento não existe na org', async () => {
      prisma.procedure.findFirst.mockResolvedValue(null);

      await expect(service.remove(orgId, 'proc-inexistente')).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.procedure.delete).not.toHaveBeenCalled();
    });
  });
});
