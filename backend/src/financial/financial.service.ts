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
    const installments = dto.installments ?? 1;

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
      include: {
        patient: { select: { id: true, name: true } },
        appointment: { select: { id: true, startAt: true } },
      },
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

    const include = {
      patient: { select: { id: true, name: true } as const },
      appointment: { select: { id: true, startAt: true } as const },
    };

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

  async findByPatient(organizationId: string, patientId: string) {
    return this.prisma.financialRecord.findMany({
      where: { organizationId, patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, name: true } },
        appointment: { select: { id: true, startAt: true } },
      },
    });
  }

  async findAll(organizationId: string, query: QueryFinancialDto) {
    const include = {
      patient: { select: { id: true, name: true } },
      appointment: { select: { id: true, startAt: true } },
    };

    if (query.startDate || query.endDate) {
      const start = query.startDate ? new Date(query.startDate) : undefined;
      // Include the full end day
      const end = query.endDate
        ? new Date(query.endDate + 'T23:59:59.999Z')
        : undefined;

      return this.prisma.financialRecord.findMany({
        where: {
          organizationId,
          OR: [
            // Records with an explicit due date in range
            {
              dueDate: {
                ...(start && { gte: start }),
                ...(end && { lte: end }),
              },
            },
            // Records without a due date, fall back to createdAt
            {
              dueDate: null,
              createdAt: {
                ...(start && { gte: start }),
                ...(end && { lte: end }),
              },
            },
          ],
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        include,
      });
    }

    // Default: filter by month/year using createdAt
    const startDate = new Date(query.year!, query.month! - 1, 1);
    const endDate = new Date(query.year!, query.month!, 1);

    return this.prisma.financialRecord.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate, lt: endDate },
      },
      orderBy: { createdAt: 'desc' },
      include,
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
    const startDate = new Date(query.year!, query.month! - 1, 1);
    const endDate = new Date(query.year!, query.month!, 1);

    const where = {
      organizationId,
      createdAt: { gte: startDate, lt: endDate },
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
