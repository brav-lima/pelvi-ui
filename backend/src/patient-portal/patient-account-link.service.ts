import { Injectable } from '@nestjs/common';
import { PatientAccountLinkStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PatientAccountLinkSummary {
  id: string;
  patientAccountId: string;
  patientId: string;
  organizationId: string;
  status: PatientAccountLinkStatus;
  invitedAt: Date;
  confirmedAt: Date | null;
}

@Injectable()
export class PatientAccountLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPatientId(patientId: string): Promise<PatientAccountLinkSummary | null> {
    return this.prisma.patientAccountLink.findFirst({ where: { patientId } });
  }

  async findById(id: string): Promise<PatientAccountLinkSummary | null> {
    return this.prisma.patientAccountLink.findUnique({ where: { id } });
  }

  async findAllByAccountId(patientAccountId: string): Promise<PatientAccountLinkSummary[]> {
    return this.prisma.patientAccountLink.findMany({ where: { patientAccountId } });
  }

  async create(params: {
    patientAccountId: string;
    patientId: string;
    organizationId: string;
  }): Promise<PatientAccountLinkSummary> {
    return this.prisma.patientAccountLink.create({ data: params });
  }

  async updateStatus(
    id: string,
    status: PatientAccountLinkStatus,
    confirmedAt?: Date,
  ): Promise<PatientAccountLinkSummary> {
    return this.prisma.patientAccountLink.update({
      where: { id },
      data: { status, confirmedAt },
    });
  }
}
