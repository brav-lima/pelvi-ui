import { Injectable, NotFoundException } from '@nestjs/common';
import { FinancialStatus, FinancialType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialDto } from './dto/create-financial.dto';
import { UpdateFinancialDto } from './dto/update-financial.dto';
import { QueryFinancialDto } from './dto/query-financial.dto';

const financialIncludes = {
  patient: { select: { id: true, name: true } },
  appointment: {
    select: {
      id: true,
      startAt: true,
      procedure: { select: { name: true } },
    },
  },
} as const;

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateFinancialDto) {
    const installments = dto.installments ?? 1;

    if (dto.isRecurring && (dto.recurrenceMonths ?? 0) > 1) {
      return this.createRecurring(organizationId, dto, dto.recurrenceMonths!);
    }

    if (installments > 1) {
      return this.createInstallments(organizationId, dto, installments);
    }

    return this.prisma.financialRecord.create({
      data: {
        organizationId,
        patientId: dto.patientId,
        appointmentId: dto.appointmentId,
        amount: dto.amount,
        type: dto.type,
        paymentMethod: dto.paymentMethod,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: financialIncludes,
    });
  }

  private async createInstallments(
    organizationId: string,
    dto: CreateFinancialDto,
    installments: number,
  ) {
    const baseAmount = Math.floor((dto.amount * 100) / installments) / 100;
    const remainder =
      Math.round((dto.amount - baseAmount * installments) * 100) / 100;

    const firstDueDate = dto.dueDate ? new Date(dto.dueDate) : new Date();

    const include = financialIncludes;

    const records = await this.prisma.$transaction(
      Array.from({ length: installments }, (_, i) => {
        const dueDate = new Date(firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        const isLast = i === installments - 1;
        const amount = isLast ? baseAmount + remainder : baseAmount;

        const desc = dto.description
          ? `${dto.description} (Parcela ${i + 1}/${installments})`
          : `Parcela ${i + 1}/${installments}`;

        return this.prisma.financialRecord.create({
          data: {
            organizationId,
            patientId: dto.patientId,
            appointmentId: dto.appointmentId,
            amount,
            type: dto.type,
            paymentMethod: dto.paymentMethod,
            description: desc,
            dueDate,
            installment: i + 1,
            installmentTotal: installments,
          },
          include,
        });
      }),
    );

    return records;
  }

  private async createRecurring(
    organizationId: string,
    dto: CreateFinancialDto,
    months: number,
  ) {
    const groupId = randomUUID();
    const firstDueDate = dto.dueDate ? new Date(dto.dueDate + 'T00:00:00') : new Date();
    const include = financialIncludes;

    return this.prisma.$transaction(
      Array.from({ length: months }, (_, i) => {
        const dueDate = new Date(firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        return this.prisma.financialRecord.create({
          data: {
            organizationId,
            patientId: dto.patientId,
            appointmentId: dto.appointmentId,
            amount: dto.amount,
            type: dto.type,
            paymentMethod: dto.paymentMethod,
            description: dto.description,
            dueDate,
            recurrenceGroupId: groupId,
            recurrenceIndex: i,
          },
          include,
        });
      }),
    );
  }

  async findByPatient(organizationId: string, patientId: string) {
    return this.prisma.financialRecord.findMany({
      where: { organizationId, patientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: financialIncludes,
    });
  }

  async findAll(organizationId: string, query: QueryFinancialDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const include = financialIncludes;

    let where: Prisma.FinancialRecordWhereInput;

    if (query.startDate || query.endDate) {
      const start = query.startDate ? new Date(query.startDate) : undefined;
      const end = query.endDate
        ? new Date(query.endDate + 'T23:59:59.999Z')
        : undefined;

      where = {
        organizationId,
        deletedAt: null,
        OR: [
          {
            dueDate: {
              ...(start && { gte: start }),
              ...(end && { lte: end }),
            },
          },
          {
            dueDate: null,
            createdAt: {
              ...(start && { gte: start }),
              ...(end && { lte: end }),
            },
          },
        ],
      };
    } else {
      const startDate = new Date(query.year!, query.month! - 1, 1);
      const endDate = new Date(query.year!, query.month!, 1);
      where = {
        organizationId,
        deletedAt: null,
        OR: [
          {
            dueDate: { gte: startDate, lt: endDate },
          },
          {
            dueDate: null,
            createdAt: { gte: startDate, lt: endDate },
          },
        ],
      };
    }

    const orderBy: Prisma.FinancialRecordOrderByWithRelationInput[] =
      query.startDate || query.endDate
        ? [{ dueDate: 'asc' }, { createdAt: 'asc' }]
        : [{ createdAt: 'desc' }];

    const [data, total] = await Promise.all([
      this.prisma.financialRecord.findMany({ where, orderBy, include, skip, take: limit }),
      this.prisma.financialRecord.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(organizationId: string, id: string) {
    const record = await this.prisma.financialRecord.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: financialIncludes,
    });

    if (!record) {
      throw new NotFoundException('Registro financeiro não encontrado');
    }

    return record;
  }

  async update(organizationId: string, id: string, dto: UpdateFinancialDto) {
    await this.findById(organizationId, id);

    return this.prisma.financialRecord.update({
      where: { id },
      data: dto,
      include: financialIncludes,
    });
  }

  async remove(
    organizationId: string,
    id: string,
    mode: 'single' | 'this_and_future' = 'single',
  ) {
    const record = await this.findById(organizationId, id);

    if (mode === 'this_and_future' && record.recurrenceGroupId) {
      return this.prisma.financialRecord.updateMany({
        where: {
          organizationId,
          recurrenceGroupId: record.recurrenceGroupId,
          recurrenceIndex: { gte: record.recurrenceIndex },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    }

    return this.prisma.financialRecord.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async summary(organizationId: string, query: QueryFinancialDto) {
    const startDate = new Date(query.year!, query.month! - 1, 1);
    const endDate = new Date(query.year!, query.month!, 1);

    const where = {
      organizationId,
      deletedAt: null,
      OR: [
        { dueDate: { gte: startDate, lt: endDate } },
        { dueDate: null, createdAt: { gte: startDate, lt: endDate } },
      ],
    };

    const [received, pending, expenses] = await Promise.all([
      this.prisma.financialRecord.aggregate({
        where: { ...where, type: FinancialType.INCOME, status: FinancialStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.financialRecord.aggregate({
        where: { ...where, type: FinancialType.INCOME, status: FinancialStatus.PENDING },
        _sum: { amount: true },
      }),
      this.prisma.financialRecord.aggregate({
        where: { ...where, type: FinancialType.EXPENSE, status: FinancialStatus.PAID },
        _sum: { amount: true },
      }),
    ]);

    const totalReceived = Number(received._sum.amount ?? 0);
    const totalPending = Number(pending._sum.amount ?? 0);
    const totalExpenses = Number(expenses._sum.amount ?? 0);

    return {
      month: query.month,
      year: query.year,
      totalReceived,
      totalPending,
      totalExpenses,
      balance: totalReceived - totalExpenses,
    };
  }
}
