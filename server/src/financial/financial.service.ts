import { Injectable, NotFoundException } from '@nestjs/common';
import { FinancialStatus, FinancialType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialDto } from './dto/create-financial.dto';
import { UpdateFinancialDto } from './dto/update-financial.dto';
import { QueryFinancialDto } from './dto/query-financial.dto';

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateFinancialDto) {
    return this.prisma.financialRecord.create({
      data: {
        organizationId,
        patientId: dto.patientId,
        appointmentId: dto.appointmentId,
        amount: dto.amount,
        type: dto.type,
        paymentMethod: dto.paymentMethod,
        description: dto.description,
      },
      include: {
        patient: { select: { id: true, name: true } },
        appointment: { select: { id: true, startAt: true } },
      },
    });
  }

  async findAll(organizationId: string, query: QueryFinancialDto) {
    const startDate = new Date(query.year, query.month - 1, 1);
    const endDate = new Date(query.year, query.month, 1);

    return this.prisma.financialRecord.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate, lt: endDate },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, name: true } },
        appointment: { select: { id: true, startAt: true } },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    const record = await this.prisma.financialRecord.findFirst({
      where: { id, organizationId },
      include: {
        patient: { select: { id: true, name: true } },
        appointment: { select: { id: true, startAt: true } },
      },
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
      include: {
        patient: { select: { id: true, name: true } },
        appointment: { select: { id: true, startAt: true } },
      },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findById(organizationId, id);

    return this.prisma.financialRecord.delete({ where: { id } });
  }

  async summary(organizationId: string, query: QueryFinancialDto) {
    const startDate = new Date(query.year, query.month - 1, 1);
    const endDate = new Date(query.year, query.month, 1);

    const where = {
      organizationId,
      createdAt: { gte: startDate, lt: endDate },
    };

    const [incomeRecords, expenseRecords] = await Promise.all([
      this.prisma.financialRecord.findMany({
        where: { ...where, type: FinancialType.INCOME },
        select: { amount: true, status: true },
      }),
      this.prisma.financialRecord.findMany({
        where: { ...where, type: FinancialType.EXPENSE },
        select: { amount: true, status: true },
      }),
    ]);

    const totalReceived = incomeRecords
      .filter((r) => r.status === FinancialStatus.PAID)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const totalPending = incomeRecords
      .filter((r) => r.status === FinancialStatus.PENDING)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const totalExpenses = expenseRecords.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );

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
