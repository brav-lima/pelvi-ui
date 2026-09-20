import { Injectable, NotFoundException } from '@nestjs/common';
import { VoidingDiaryEntry, VoidingLeakageAmount } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateVoidingDiaryEntryData {
  recordedAt: Date;
  urineVolumeMl: number | null;
  voidingDurationSeconds: number | null;
  fluidIntakeMl: number | null;
  hadLeakage: boolean;
  leakageAmount: VoidingLeakageAmount | null;
  changedPad: boolean;
}

@Injectable()
export class VoidingDiaryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    patientId: string,
    data: CreateVoidingDiaryEntryData,
  ): Promise<VoidingDiaryEntry> {
    return this.prisma.voidingDiaryEntry.create({
      data: {
        organizationId,
        patientId,
        ...data,
        leakageAmount: data.hadLeakage ? data.leakageAmount : null,
      },
    });
  }

  async findAllForPatient(
    organizationId: string,
    patientId: string,
    from?: Date,
    to?: Date,
  ): Promise<VoidingDiaryEntry[]> {
    const recordedAtFilter =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    return this.prisma.voidingDiaryEntry.findMany({
      where: {
        organizationId,
        patientId,
        deletedAt: null,
        ...(recordedAtFilter ? { recordedAt: recordedAtFilter } : {}),
      },
      orderBy: { recordedAt: 'asc' },
    });
  }

  async softDelete(organizationId: string, patientId: string, entryId: string): Promise<void> {
    const entry = await this.prisma.voidingDiaryEntry.findFirst({
      where: { id: entryId, organizationId, patientId, deletedAt: null },
    });
    if (!entry) {
      throw new NotFoundException('Registro não encontrado');
    }
    await this.prisma.voidingDiaryEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date() },
    });
  }
}
