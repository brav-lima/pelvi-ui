import { Injectable, NotFoundException } from '@nestjs/common';
import { BowelDiaryEntry, BowelEffort, BowelSensation, BowelLeakageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateBowelDiaryEntryData {
  recordedAt: Date;
  hadBowelMovement: boolean;
  bristolType: string | null;
  effort: BowelEffort | null;
  sensation: BowelSensation | null;
  bowelMovementDurationSeconds: number | null;
  hadLeakage: boolean;
  leakageType: BowelLeakageType | null;
}

@Injectable()
export class BowelDiaryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    patientId: string,
    data: CreateBowelDiaryEntryData,
  ): Promise<BowelDiaryEntry> {
    return this.prisma.bowelDiaryEntry.create({
      data: {
        organizationId,
        patientId,
        ...data,
        bristolType: data.hadBowelMovement ? data.bristolType : null,
        effort: data.hadBowelMovement ? data.effort : null,
        sensation: data.hadBowelMovement ? data.sensation : null,
        bowelMovementDurationSeconds: data.hadBowelMovement ? data.bowelMovementDurationSeconds : null,
        leakageType: data.hadLeakage ? data.leakageType : null,
      },
    });
  }

  async findAllForPatient(
    organizationId: string,
    patientId: string,
    from?: Date,
    to?: Date,
  ): Promise<BowelDiaryEntry[]> {
    const recordedAtFilter =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    return this.prisma.bowelDiaryEntry.findMany({
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
    const entry = await this.prisma.bowelDiaryEntry.findFirst({
      where: { id: entryId, organizationId, patientId, deletedAt: null },
    });
    if (!entry) {
      throw new NotFoundException('Registro não encontrado');
    }
    await this.prisma.bowelDiaryEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date() },
    });
  }
}
