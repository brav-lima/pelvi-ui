import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FinancialType, TreatmentPackageStatus } from '@prisma/client';
import { TreatmentPackageService } from './treatment-package.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TreatmentPackageService', () => {
  let service: TreatmentPackageService;
  let prisma: {
    procedure: any;
    treatmentPackage: any;
    financialRecord: any;
    $transaction: jest.Mock;
  };

  // Mock do cliente de transação interativa
  let txMock: {
    treatmentPackage: any;
    treatmentPackageProcedure: any;
    financialRecord: any;
  };

  const orgId = 'org-1';

  const mockPkg = {
    id: 'pkg-1',
    organizationId: orgId,
    name: 'Pacote Fisio',
    totalSessions: 10,
    totalPrice: 1000,
    usedSessions: 0,
    status: TreatmentPackageStatus.ACTIVE,
  };

  beforeEach(async () => {
    txMock = {
      treatmentPackage: {
        create: jest.fn().mockResolvedValue(mockPkg),
        findUniqueOrThrow: jest.fn().mockResolvedValue(mockPkg),
      },
      treatmentPackageProcedure: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      financialRecord: {
        create: jest.fn().mockResolvedValue({ id: 'fin-1' }),
      },
    };

    prisma = {
      procedure: {
        findMany: jest.fn(),
      },
      treatmentPackage: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      financialRecord: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      // Suporta transação interativa (callback) e batch (array de promises)
      $transaction: jest.fn((arg) => {
        if (typeof arg === 'function') return arg(txMock);
        return Promise.all(arg);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TreatmentPackageService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TreatmentPackageService>(TreatmentPackageService);
  });

  describe('create', () => {
    const baseDto = {
      patientId: 'patient-1',
      name: 'Pacote Fisio',
      totalSessions: 10,
      totalPrice: 1000,
      procedureIds: ['proc-1'],
    };

    it('deve lançar NotFoundException quando procedimento não pertence à organização', async () => {
      prisma.procedure.findMany.mockResolvedValue([]); // nenhum proc encontrado na org

      await expect(service.create(orgId, baseDto)).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('deve criar pacote com pagamento único quando installments não informado', async () => {
      prisma.procedure.findMany.mockResolvedValue([{ id: 'proc-1' }]);

      await service.create(orgId, baseDto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(txMock.treatmentPackage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: orgId, patientId: 'patient-1' }),
        }),
      );
      expect(txMock.treatmentPackageProcedure.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ treatmentPackageId: mockPkg.id, procedureId: 'proc-1' }],
        }),
      );
      // Pagamento único — create chamado 1x
      expect(txMock.financialRecord.create).toHaveBeenCalledTimes(1);
    });

    it('deve criar N registros financeiros quando installments > 1', async () => {
      prisma.procedure.findMany.mockResolvedValue([{ id: 'proc-1' }]);

      await service.create(orgId, { ...baseDto, installments: 3, totalPrice: 300 });

      expect(txMock.financialRecord.create).toHaveBeenCalledTimes(3);
    });

    it('deve distribuir corretamente o resto na última parcela', async () => {
      prisma.procedure.findMany.mockResolvedValue([{ id: 'proc-1' }]);

      // R$100 em 3 parcelas: 33.33 + 33.33 + 33.34
      await service.create(orgId, { ...baseDto, installments: 3, totalPrice: 100 });

      const calls = txMock.financialRecord.create.mock.calls;
      expect(calls[0][0].data.amount).toBeCloseTo(33.33, 2);
      expect(calls[1][0].data.amount).toBeCloseTo(33.33, 2);
      expect(calls[2][0].data.amount).toBeCloseTo(33.34, 2);
    });

    it('deve formatar a descrição de cada parcela', async () => {
      prisma.procedure.findMany.mockResolvedValue([{ id: 'proc-1' }]);

      await service.create(orgId, { ...baseDto, installments: 2 });

      const calls = txMock.financialRecord.create.mock.calls;
      expect(calls[0][0].data.description).toContain('Parcela 1/2');
      expect(calls[1][0].data.description).toContain('Parcela 2/2');
    });
  });

  describe('findAll', () => {
    it('deve listar pacotes da organização', async () => {
      prisma.treatmentPackage.findMany.mockResolvedValue([mockPkg]);

      const result = await service.findAll(orgId);

      expect(prisma.treatmentPackage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: orgId } }),
      );
      expect(result).toEqual([mockPkg]);
    });

    it('deve filtrar por patientId quando informado', async () => {
      prisma.treatmentPackage.findMany.mockResolvedValue([]);

      await service.findAll(orgId, 'patient-1');

      const callArgs = prisma.treatmentPackage.findMany.mock.calls[0][0];
      expect(callArgs.where.patientId).toBe('patient-1');
    });
  });

  describe('findById', () => {
    it('deve retornar pacote quando pertence à organização', async () => {
      prisma.treatmentPackage.findFirst.mockResolvedValue(mockPkg);

      const result = await service.findById(orgId, 'pkg-1');

      expect(prisma.treatmentPackage.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pkg-1', organizationId: orgId } }),
      );
      expect(result).toEqual(mockPkg);
    });

    it('deve lançar NotFoundException quando não encontrado ou de outra organização', async () => {
      prisma.treatmentPackage.findFirst.mockResolvedValue(null);

      await expect(service.findById(orgId, 'pkg-outro')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('deve lançar NotFoundException antes de atualizar quando pacote não existe', async () => {
      prisma.treatmentPackage.findFirst.mockResolvedValue(null);

      await expect(service.update(orgId, 'pkg-inexistente', {})).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.treatmentPackage.update).not.toHaveBeenCalled();
    });

    it('deve atualizar quando pacote pertence à organização', async () => {
      prisma.treatmentPackage.findFirst.mockResolvedValue(mockPkg);
      prisma.treatmentPackage.update.mockResolvedValue({ ...mockPkg, name: 'Novo nome' });

      await service.update(orgId, 'pkg-1', { name: 'Novo nome' });

      expect(prisma.treatmentPackage.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pkg-1' } }),
      );
    });
  });

  describe('remove', () => {
    it('deve lançar BadRequestException quando pacote possui sessões utilizadas', async () => {
      prisma.treatmentPackage.findFirst.mockResolvedValue({ ...mockPkg, usedSessions: 3 });

      await expect(service.remove(orgId, 'pkg-1')).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('deve deletar registros financeiros vinculados e o pacote via transação', async () => {
      prisma.treatmentPackage.findFirst.mockResolvedValue({ ...mockPkg, usedSessions: 0 });
      prisma.treatmentPackage.delete = jest.fn().mockResolvedValue(mockPkg);

      await service.remove(orgId, 'pkg-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.financialRecord.deleteMany).toHaveBeenCalledWith({
        where: { treatmentPackageId: 'pkg-1' },
      });
      expect(prisma.treatmentPackage.delete).toHaveBeenCalledWith({ where: { id: 'pkg-1' } });
    });
  });

  describe('incrementUsedSessions', () => {
    it('deve incrementar sessões e manter status ACTIVE quando não esgotou', async () => {
      prisma.treatmentPackage.findFirst.mockResolvedValue({ ...mockPkg, usedSessions: 8, totalSessions: 10 });
      prisma.treatmentPackage.update.mockResolvedValue({});

      await service.incrementUsedSessions(orgId, 'pkg-1');

      expect(prisma.treatmentPackage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { usedSessions: 9, status: TreatmentPackageStatus.ACTIVE },
        }),
      );
    });

    it('deve marcar status como COMPLETED quando última sessão é utilizada', async () => {
      prisma.treatmentPackage.findFirst.mockResolvedValue({ ...mockPkg, usedSessions: 9, totalSessions: 10 });
      prisma.treatmentPackage.update.mockResolvedValue({});

      await service.incrementUsedSessions(orgId, 'pkg-1');

      expect(prisma.treatmentPackage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { usedSessions: 10, status: TreatmentPackageStatus.COMPLETED },
        }),
      );
    });

    it('deve ignorar silenciosamente quando pacote não está ACTIVE', async () => {
      prisma.treatmentPackage.findFirst.mockResolvedValue({
        ...mockPkg,
        status: TreatmentPackageStatus.COMPLETED,
      });

      await service.incrementUsedSessions(orgId, 'pkg-1');

      expect(prisma.treatmentPackage.update).not.toHaveBeenCalled();
    });

    it('deve ignorar silenciosamente quando pacote não encontrado', async () => {
      prisma.treatmentPackage.findFirst.mockResolvedValue(null);

      await service.incrementUsedSessions(orgId, 'pkg-inexistente');

      expect(prisma.treatmentPackage.update).not.toHaveBeenCalled();
    });
  });

  describe('decrementUsedSessions', () => {
    it('deve decrementar sessões e restaurar status para ACTIVE', async () => {
      prisma.treatmentPackage.findFirst.mockResolvedValue({
        ...mockPkg,
        usedSessions: 5,
        status: TreatmentPackageStatus.COMPLETED,
      });
      prisma.treatmentPackage.update.mockResolvedValue({});

      await service.decrementUsedSessions(orgId, 'pkg-1');

      expect(prisma.treatmentPackage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { usedSessions: 4, status: TreatmentPackageStatus.ACTIVE },
        }),
      );
    });

    it('deve ignorar silenciosamente quando usedSessions é 0', async () => {
      prisma.treatmentPackage.findFirst.mockResolvedValue({ ...mockPkg, usedSessions: 0 });

      await service.decrementUsedSessions(orgId, 'pkg-1');

      expect(prisma.treatmentPackage.update).not.toHaveBeenCalled();
    });
  });
});
