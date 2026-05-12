import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FinancialType, FinancialStatus } from '@prisma/client';
import { FinancialService } from './financial.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FinancialService', () => {
  let service: FinancialService;
  let prisma: { financialRecord: any; $transaction: jest.Mock };

  const orgId = 'org-1';

  beforeEach(async () => {
    prisma = {
      financialRecord: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      // Batch $transaction: recebe array de promises e executa todas
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FinancialService>(FinancialService);
  });

  describe('create (registro único)', () => {
    it('deve criar registro financeiro simples sem parcelas', async () => {
      const dto = {
        patientId: 'patient-1',
        amount: 200,
        type: FinancialType.INCOME,
        description: 'Consulta',
      };
      const created = { id: 'fin-1', organizationId: orgId, ...dto };
      prisma.financialRecord.create.mockResolvedValue(created);

      const result = await service.create(orgId, dto);

      expect(prisma.financialRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            patientId: 'patient-1',
            amount: 200,
          }),
        }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe('create (parcelamento)', () => {
    it('deve criar N registros via $transaction com valor base e resto na última parcela', async () => {
      // R$100 em 3 parcelas: 33.33 + 33.33 + 33.34
      const dto = {
        patientId: 'patient-1',
        amount: 100,
        type: FinancialType.INCOME,
        installments: 3,
        description: 'Pacote',
        dueDate: '2025-01-01',
      };

      prisma.financialRecord.create
        .mockResolvedValueOnce({ id: 'fin-1', amount: 33.33, installment: 1 })
        .mockResolvedValueOnce({ id: 'fin-2', amount: 33.33, installment: 2 })
        .mockResolvedValueOnce({ id: 'fin-3', amount: 33.34, installment: 3 });

      await service.create(orgId, dto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.financialRecord.create).toHaveBeenCalledTimes(3);

      const calls = prisma.financialRecord.create.mock.calls;
      expect(calls[0][0].data.amount).toBeCloseTo(33.33, 2);
      expect(calls[1][0].data.amount).toBeCloseTo(33.33, 2);
      expect(calls[2][0].data.amount).toBeCloseTo(33.34, 2);
    });

    it('deve incrementar a data de vencimento mês a mês', async () => {
      const dto = {
        patientId: 'patient-1',
        amount: 60,
        type: FinancialType.INCOME,
        installments: 3,
        dueDate: '2025-03-01',
      };

      prisma.financialRecord.create.mockResolvedValue({ id: 'fin-x' });

      await service.create(orgId, dto);

      const calls = prisma.financialRecord.create.mock.calls;
      const d0: Date = calls[0][0].data.dueDate;
      const d1: Date = calls[1][0].data.dueDate;
      const d2: Date = calls[2][0].data.dueDate;

      // Cada parcela avança exatamente 1 mês em relação à anterior
      expect(d1.getMonth() - d0.getMonth()).toBe(1);
      expect(d2.getMonth() - d1.getMonth()).toBe(1);
    });

    it('deve formatar descrição das parcelas corretamente', async () => {
      const dto = {
        patientId: 'patient-1',
        amount: 200,
        type: FinancialType.INCOME,
        installments: 2,
        description: 'Tratamento',
      };

      prisma.financialRecord.create.mockResolvedValue({ id: 'fin-x' });

      await service.create(orgId, dto);

      const calls = prisma.financialRecord.create.mock.calls;
      expect(calls[0][0].data.description).toBe('Tratamento (Parcela 1/2)');
      expect(calls[1][0].data.description).toBe('Tratamento (Parcela 2/2)');
    });

    it('deve usar descrição padrão quando não informada', async () => {
      const dto = {
        patientId: 'patient-1',
        amount: 100,
        type: FinancialType.INCOME,
        installments: 2,
      };

      prisma.financialRecord.create.mockResolvedValue({ id: 'fin-x' });

      await service.create(orgId, dto);

      const calls = prisma.financialRecord.create.mock.calls;
      expect(calls[0][0].data.description).toBe('Parcela 1/2');
      expect(calls[1][0].data.description).toBe('Parcela 2/2');
    });
  });

  describe('findAll', () => {
    it('deve filtrar por startDate e endDate quando informados', async () => {
      prisma.financialRecord.findMany.mockResolvedValue([]);

      await service.findAll(orgId, { startDate: '2025-01-01', endDate: '2025-01-31' });

      expect(prisma.financialRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('deve filtrar por mês/ano quando startDate não informado', async () => {
      prisma.financialRecord.findMany.mockResolvedValue([]);

      await service.findAll(orgId, { month: 3, year: 2025 });

      const callArgs = prisma.financialRecord.findMany.mock.calls[0][0];
      expect(callArgs.where.organizationId).toBe(orgId);
      expect(callArgs.where.createdAt.gte).toEqual(new Date(2025, 2, 1));  // março
      expect(callArgs.where.createdAt.lt).toEqual(new Date(2025, 3, 1));   // abril
    });
  });

  describe('findById', () => {
    it('deve retornar registro quando pertence à organização', async () => {
      const record = { id: 'fin-1', organizationId: orgId, amount: 150 };
      prisma.financialRecord.findFirst.mockResolvedValue(record);

      const result = await service.findById(orgId, 'fin-1');

      expect(prisma.financialRecord.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'fin-1', organizationId: orgId } }),
      );
      expect(result).toEqual(record);
    });

    it('deve lançar NotFoundException quando não encontrado ou de outra organização', async () => {
      prisma.financialRecord.findFirst.mockResolvedValue(null);

      await expect(service.findById(orgId, 'fin-outro')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('deve atualizar registro quando pertence à organização', async () => {
      const existing = { id: 'fin-1', organizationId: orgId };
      const updated = { ...existing, amount: 300 };
      prisma.financialRecord.findFirst.mockResolvedValue(existing);
      prisma.financialRecord.update.mockResolvedValue(updated);

      const result = await service.update(orgId, 'fin-1', { amount: 300 } as any);

      expect(prisma.financialRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'fin-1' }, data: { amount: 300 } }),
      );
      expect(result).toEqual(updated);
    });

    it('deve lançar NotFoundException antes de atualizar quando não existe na org', async () => {
      prisma.financialRecord.findFirst.mockResolvedValue(null);

      await expect(service.update(orgId, 'fin-inexistente', {} as any)).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.financialRecord.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deve deletar registro quando pertence à organização', async () => {
      const existing = { id: 'fin-1', organizationId: orgId };
      prisma.financialRecord.findFirst.mockResolvedValue(existing);
      prisma.financialRecord.delete.mockResolvedValue(existing);

      await service.remove(orgId, 'fin-1');

      expect(prisma.financialRecord.delete).toHaveBeenCalledWith({ where: { id: 'fin-1' } });
    });

    it('deve lançar NotFoundException antes de deletar quando não existe na org', async () => {
      prisma.financialRecord.findFirst.mockResolvedValue(null);

      await expect(service.remove(orgId, 'fin-inexistente')).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.financialRecord.delete).not.toHaveBeenCalled();
    });
  });

  describe('summary', () => {
    it('deve calcular totais corretamente separando INCOME e EXPENSE', async () => {
      prisma.financialRecord.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 700 } })  // received (INCOME + PAID)
        .mockResolvedValueOnce({ _sum: { amount: 100 } })  // pending (INCOME + PENDING)
        .mockResolvedValueOnce({ _sum: { amount: 150 } }); // expenses (EXPENSE + PAID)

      const result = await service.summary(orgId, { month: 3, year: 2025 });

      expect(result.totalReceived).toBeCloseTo(700);
      expect(result.totalPending).toBeCloseTo(100);
      expect(result.totalExpenses).toBeCloseTo(150);
      expect(result.balance).toBeCloseTo(550); // 700 - 150
    });

    it('deve retornar zeros quando não há registros no mês', async () => {
      prisma.financialRecord.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });

      const result = await service.summary(orgId, { month: 1, year: 2025 });

      expect(result.totalReceived).toBe(0);
      expect(result.totalPending).toBe(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.balance).toBe(0);
    });

    it('deve filtrar pelo mês e ano corretos', async () => {
      prisma.financialRecord.aggregate.mockResolvedValue({ _sum: { amount: null } });

      await service.summary(orgId, { month: 6, year: 2025 });

      const firstCall = prisma.financialRecord.aggregate.mock.calls[0][0];
      expect(firstCall.where.createdAt.gte).toEqual(new Date(2025, 5, 1));  // junho
      expect(firstCall.where.createdAt.lt).toEqual(new Date(2025, 6, 1));   // julho
    });
  });
});
