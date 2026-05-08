import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialType,
  TreatmentPackageStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTreatmentPackageDto } from './dto/create-treatment-package.dto';
import { UpdateTreatmentPackageDto } from './dto/update-treatment-package.dto';

const packageIncludes = {
  patient: { select: { id: true, name: true } },
  procedures: {
    include: {
      procedure: {
        select: { id: true, name: true, durationMinutes: true },
      },
    },
  },
} satisfies Prisma.TreatmentPackageInclude;

@Injectable()
export class TreatmentPackageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateTreatmentPackageDto) {
    // Validate all procedures belong to the org
    const procedures = await this.prisma.procedure.findMany({
      where: { id: { in: dto.procedureIds }, organizationId },
      select: { id: true },
    });

    if (procedures.length !== dto.procedureIds.length) {
      throw new NotFoundException(
        'Um ou mais procedimentos não foram encontrados',
      );
    }

    const installments = dto.installments ?? 1;
    const firstDueDate = dto.dueDate ? new Date(dto.dueDate) : new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the package
      const pkg = await tx.treatmentPackage.create({
        data: {
          organizationId,
          patientId: dto.patientId,
          name: dto.name,
          totalSessions: dto.totalSessions,
          totalPrice: dto.totalPrice,
          notes: dto.notes,
        },
      });

      // 2. Create procedure links
      await tx.treatmentPackageProcedure.createMany({
        data: dto.procedureIds.map((procedureId) => ({
          treatmentPackageId: pkg.id,
          procedureId,
        })),
      });

      // 3. Generate financial records
      if (installments <= 1) {
        await tx.financialRecord.create({
          data: {
            organizationId,
            patientId: dto.patientId,
            treatmentPackageId: pkg.id,
            amount: dto.totalPrice,
            type: FinancialType.INCOME,
            paymentMethod: dto.paymentMethod,
            description: `Pacote: ${dto.name}`,
            dueDate: firstDueDate,
          },
        });
      } else {
        const baseAmount =
          Math.floor((dto.totalPrice * 100) / installments) / 100;
        const remainder =
          Math.round((dto.totalPrice - baseAmount * installments) * 100) / 100;

        for (let i = 0; i < installments; i++) {
          const dueDate = new Date(firstDueDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          const isLast = i === installments - 1;
          const amount = isLast ? baseAmount + remainder : baseAmount;

          await tx.financialRecord.create({
            data: {
              organizationId,
              patientId: dto.patientId,
              treatmentPackageId: pkg.id,
              amount,
              type: FinancialType.INCOME,
              paymentMethod: dto.paymentMethod,
              description: `Pacote: ${dto.name} (Parcela ${i + 1}/${installments})`,
              dueDate,
              installment: i + 1,
              installmentTotal: installments,
            },
          });
        }
      }

      // 4. Return with includes
      return tx.treatmentPackage.findUniqueOrThrow({
        where: { id: pkg.id },
        include: packageIncludes,
      });
    });
  }

  async findAll(organizationId: string, patientId?: string) {
    const where: Prisma.TreatmentPackageWhereInput = { organizationId };
    if (patientId) where.patientId = patientId;

    return this.prisma.treatmentPackage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: packageIncludes,
    });
  }

  async findById(organizationId: string, id: string) {
    const pkg = await this.prisma.treatmentPackage.findFirst({
      where: { id, organizationId },
      include: packageIncludes,
    });

    if (!pkg) {
      throw new NotFoundException('Pacote de tratamento não encontrado');
    }

    return pkg;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateTreatmentPackageDto,
  ) {
    await this.findById(organizationId, id);

    return this.prisma.treatmentPackage.update({
      where: { id },
      data: dto,
      include: packageIncludes,
    });
  }

  async remove(organizationId: string, id: string) {
    const pkg = await this.findById(organizationId, id);

    if (pkg.usedSessions > 0) {
      throw new BadRequestException(
        'Não é possível excluir pacote com sessões utilizadas',
      );
    }

    // Delete financial records linked to this package, then the package
    await this.prisma.$transaction([
      this.prisma.financialRecord.deleteMany({
        where: { treatmentPackageId: id },
      }),
      this.prisma.treatmentPackage.delete({ where: { id } }),
    ]);
  }

  async incrementUsedSessions(
    organizationId: string,
    packageId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const pkg = await client.treatmentPackage.findFirst({
      where: { id: packageId, organizationId },
    });

    if (!pkg || pkg.status !== TreatmentPackageStatus.ACTIVE) return;

    const newUsed = pkg.usedSessions + 1;
    const newStatus =
      newUsed >= pkg.totalSessions
        ? TreatmentPackageStatus.COMPLETED
        : TreatmentPackageStatus.ACTIVE;

    await client.treatmentPackage.update({
      where: { id: packageId },
      data: { usedSessions: newUsed, status: newStatus },
    });
  }

  async decrementUsedSessions(
    organizationId: string,
    packageId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const pkg = await client.treatmentPackage.findFirst({
      where: { id: packageId, organizationId },
    });

    if (!pkg || pkg.usedSessions <= 0) return;

    const newUsed = pkg.usedSessions - 1;

    await client.treatmentPackage.update({
      where: { id: packageId },
      data: {
        usedSessions: newUsed,
        status: TreatmentPackageStatus.ACTIVE,
      },
    });
  }
}
