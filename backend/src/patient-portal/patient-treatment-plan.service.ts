import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PatientLookupService } from '../patient/patient-lookup.service';

export interface PatientTreatmentPlanFeatures {
  diarioMiccional: boolean;
  diarioEvacuatorio: boolean;
  cronometros: boolean;
}

const DEFAULT_FEATURES: PatientTreatmentPlanFeatures = {
  diarioMiccional: false,
  diarioEvacuatorio: false,
  cronometros: false,
};

@Injectable()
export class PatientTreatmentPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientLookup: PatientLookupService,
  ) {}

  async getForPatient(organizationId: string, patientId: string): Promise<PatientTreatmentPlanFeatures> {
    // Já seguro sem checagem adicional: o `where` filtra por organizationId
    // diretamente, então um paciente de outra organização nunca resulta em
    // dado retornado aqui (na pior hipótese, cai no default abaixo).
    const plan = await this.prisma.patientTreatmentPlan.findFirst({
      where: { organizationId, patientId },
    });
    return (plan?.features as unknown as PatientTreatmentPlanFeatures) ?? DEFAULT_FEATURES;
  }

  async upsertFeatures(
    organizationId: string,
    patientId: string,
    features: PatientTreatmentPlanFeatures,
    updatedByPersonId: string,
  ): Promise<PatientTreatmentPlanFeatures> {
    const patient = await this.patientLookup.findById(patientId);
    if (!patient || patient.organizationId !== organizationId) {
      throw new NotFoundException('Paciente não encontrada');
    }

    const plan = await this.prisma.patientTreatmentPlan.upsert({
      where: { patientId },
      create: {
        patientId,
        organizationId,
        features: features as unknown as Prisma.InputJsonValue,
        updatedByPersonId,
      },
      update: {
        organizationId,
        features: features as unknown as Prisma.InputJsonValue,
        updatedByPersonId,
      },
    });
    return plan.features as unknown as PatientTreatmentPlanFeatures;
  }
}
