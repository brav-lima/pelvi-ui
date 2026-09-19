import { Injectable } from '@nestjs/common';
import { PatientAccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PatientAccountSummary {
  id: string;
  cpf: string;
  passwordHash: string | null;
  status: PatientAccountStatus;
  createdAt: Date;
  activatedAt: Date | null;
}

@Injectable()
export class PatientAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCpf(cpf: string): Promise<PatientAccountSummary | null> {
    return this.prisma.patientAccount.findUnique({ where: { cpf } });
  }

  async findById(id: string): Promise<PatientAccountSummary | null> {
    return this.prisma.patientAccount.findUnique({ where: { id } });
  }

  async createPending(cpf: string): Promise<PatientAccountSummary> {
    return this.prisma.patientAccount.create({ data: { cpf } });
  }

  async activate(id: string, passwordHash: string): Promise<PatientAccountSummary> {
    return this.prisma.patientAccount.update({
      where: { id },
      data: { passwordHash, activatedAt: new Date() },
    });
  }
}
