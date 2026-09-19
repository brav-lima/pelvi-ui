import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PatientLookupResult {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  birthDate: Date | null;
  email: string | null;
  organizationId: string;
  organizationName: string;
}

@Injectable()
export class PatientLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(patientId: string): Promise<PatientLookupResult | null> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, deletedAt: null },
      select: {
        id: true,
        name: true,
        cpf: true,
        phone: true,
        birthDate: true,
        email: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });

    if (!patient) return null;

    return {
      id: patient.id,
      name: patient.name,
      cpf: patient.cpf,
      phone: patient.phone,
      birthDate: patient.birthDate,
      email: patient.email,
      organizationId: patient.organizationId,
      organizationName: patient.organization.name,
    };
  }
}
