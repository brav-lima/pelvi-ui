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
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
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

  describe('create (recorrência)', () => {
    it('deve criar N registros com valor integral (sem divisão)', async () => {
      const dto = {
        amount: 1500,
        type: FinancialType.EXPENSE,
        isRecurring: true,
        recurrenceMonths: 3,
        dueDate: '2026-06-10',
        description: 'Aluguel',
      };
      prisma.financialRecord.create.mockResolvedValue({ id: 'fin-x' });

      await service.create(orgId, dto as any);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.financialRecord.create).toHaveBeenCalledTimes(3);
      const calls = prisma.financialRecord.create.mock.calls;
      expect(calls[0][0].data.amount).toBe(1500);
      expect(calls[1][0].data.amount).toBe(1500);
      expect(calls[2][0].data.amount).toBe(1500);
    });

    it('deve compartilhar o mesmo recurrenceGroupId em todos os registros', async () => {
      const dto = {
        amount: 1500,
        type: FinancialType.EXPENSE,
        isRecurring: true,
        recurrenceMonths: 2,
        dueDate: '2026-06-10',
      };
      prisma.financialRecord.create.mockResolvedValue({ id: 'fin-x' });

      await service.create(orgId, dto as any);

      const calls = prisma.financialRecord.create.mock.calls;
      const g0 = calls[0][0].data.recurrenceGroupId;
      const g1 = calls[1][0].data.recurrenceGroupId;
      expect(g0).toBeDefined();
      expect(g0).toBe(g1);
    });

    it('deve atribuir recurrenceIndex sequencial começando em 0', async () => {
      const dto = {
        amount: 500,
        type: FinancialType.EXPENSE,
        isRecurring: true,
        recurrenceMonths: 3,
        dueDate: '2026-06-10',
      };
      prisma.financialRecord.create.mockResolvedValue({ id: 'fin-x' });

      await service.create(orgId, dto as any);

      const calls = prisma.financialRecord.create.mock.calls;
      expect(calls[0][0].data.recurrenceIndex).toBe(0);
      expect(calls[1][0].data.recurrenceIndex).toBe(1);
      expect(calls[2][0].data.recurrenceIndex).toBe(2);
    });

    it('deve avançar dueDate mês a mês mantendo o dia', async () => {
      const dto = {
        amount: 500,
        type: FinancialType.EXPENSE,
        isRecurring: true,
        recurrenceMonths: 3,
        dueDate: '2026-06-10',
      };
      prisma.financialRecord.create.mockResolvedValue({ id: 'fin-x' });

      await service.create(orgId, dto as any);

      const calls = prisma.financialRecord.create.mock.calls;
      const d0: Date = calls[0][0].data.dueDate;
      const d1: Date = calls[1][0].data.dueDate;
      const d2: Date = calls[2][0].data.dueDate;
      // junho → julho → agosto (0-indexed months)
      expect(d0.getMonth()).toBe(5);
      expect(d1.getMonth()).toBe(6);
      expect(d2.getMonth()).toBe(7);
      // dia preservado
      expect(d0.getDate()).toBe(10);
      expect(d1.getDate()).toBe(10);
      expect(d2.getDate()).toBe(10);
    });

    it('não deve usar $transaction quando não é recorrente', async () => {
      const dto = { amount: 200, type: FinancialType.INCOME };
      prisma.financialRecord.create.mockResolvedValue({ id: 'fin-1' });

      await service.create(orgId, dto as any);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('deve filtrar por startDate e endDate quando informados', async () => {
      prisma.financialRecord.findMany.mockResolvedValue([]);
      prisma.financialRecord.count.mockResolvedValue(0);

      const result = await service.findAll(orgId, { startDate: '2025-01-01', endDate: '2025-01-31' });

      expect(prisma.financialRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            OR: expect.any(Array),
          }),
        }),
      );
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 50, totalPages: 0 });
    });

    it('deve filtrar por mês/ano quando startDate não informado', async () => {
      prisma.financialRecord.findMany.mockResolvedValue([]);
      prisma.financialRecord.count.mockResolvedValue(0);

      await service.findAll(orgId, { month: 3, year: 2025 });

      const callArgs = prisma.financialRecord.findMany.mock.calls[0][0];
      expect(callArgs.where.organizationId).toBe(orgId);
      expect(callArgs.where.OR).toHaveLength(2);
      // primeiro branch: registros com dueDate no mês
      expect(callArgs.where.OR[0].dueDate.gte).toEqual(new Date(2025, 2, 1));
      expect(callArgs.where.OR[0].dueDate.lt).toEqual(new Date(2025, 3, 1));
      // segundo branch: registros sem dueDate, filtro por createdAt
      expect(callArgs.where.OR[1].dueDate).toBeNull();
      expect(callArgs.where.OR[1].createdAt.gte).toEqual(new Date(2025, 2, 1));
      expect(callArgs.where.OR[1].createdAt.lt).toEqual(new Date(2025, 3, 1));
    });

    it('deve respeitar page e limit passados', async () => {
      prisma.financialRecord.findMany.mockResolvedValue([]);
      prisma.financialRecord.count.mockResolvedValue(60);

      const result = await service.findAll(orgId, { month: 1, year: 2025, page: 2, limit: 20 });

      const callArgs = prisma.financialRecord.findMany.mock.calls[0][0];
      expect(callArgs.skip).toBe(20);
      expect(callArgs.take).toBe(20);
      expect(result.meta).toEqual({ total: 60, page: 2, limit: 20, totalPages: 3 });
    });
  });

  describe('findById', () => {
    it('deve retornar registro quando pertence à organização', async () => {
      const record = { id: 'fin-1', organizationId: orgId, amount: 150 };
      prisma.financialRecord.findFirst.mockResolvedValue(record);

      const result = await service.findById(orgId, 'fin-1');

      expect(prisma.financialRecord.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'fin-1', organizationId: orgId }),
        }),
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
    it('deve aplicar soft delete quando pertence à organização (mode=single)', async () => {
      const existing = { id: 'fin-1', organizationId: orgId, recurrenceGroupId: null, recurrenceIndex: null };
      prisma.financialRecord.findFirst.mockResolvedValue(existing);
      prisma.financialRecord.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      await service.remove(orgId, 'fin-1', 'single');

      expect(prisma.financialRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fin-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.financialRecord.updateMany).not.toHaveBeenCalled();
    });

    it('deve usar single delete por padrão quando mode omitido', async () => {
      const existing = { id: 'fin-1', organizationId: orgId, recurrenceGroupId: 'grp-1', recurrenceIndex: 0 };
      prisma.financialRecord.findFirst.mockResolvedValue(existing);
      prisma.financialRecord.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      await service.remove(orgId, 'fin-1');

      expect(prisma.financialRecord.update).toHaveBeenCalled();
      expect(prisma.financialRecord.updateMany).not.toHaveBeenCalled();
    });

    it('deve soft-deletar este e posteriores quando mode=this_and_future', async () => {
      const existing = { id: 'fin-2', organizationId: orgId, recurrenceGroupId: 'grp-1', recurrenceIndex: 2 };
      prisma.financialRecord.findFirst.mockResolvedValue(existing);
      prisma.financialRecord.updateMany.mockResolvedValue({ count: 3 });

      await service.remove(orgId, 'fin-2', 'this_and_future');

      expect(prisma.financialRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            recurrenceGroupId: 'grp-1',
            recurrenceIndex: { gte: 2 },
            deletedAt: null,
          }),
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.financialRecord.update).not.toHaveBeenCalled();
    });

    it('deve cair em single delete quando recurrenceGroupId é null e mode=this_and_future', async () => {
      const existing = { id: 'fin-3', organizationId: orgId, recurrenceGroupId: null, recurrenceIndex: null };
      prisma.financialRecord.findFirst.mockResolvedValue(existing);
      prisma.financialRecord.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      await service.remove(orgId, 'fin-3', 'this_and_future');

      expect(prisma.financialRecord.update).toHaveBeenCalled();
      expect(prisma.financialRecord.updateMany).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException antes de deletar quando não existe na org', async () => {
      prisma.financialRecord.findFirst.mockResolvedValue(null);

      await expect(service.remove(orgId, 'fin-inexistente')).rejects.toThrow(NotFoundException);
      expect(prisma.financialRecord.update).not.toHaveBeenCalled();
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
