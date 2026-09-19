import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async getForPatient(organizationId: string, patientId: string): Promise<PatientTreatmentPlanFeatures> {
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
    const plan = await this.prisma.patientTreatmentPlan.upsert({
      where: { patientId },
      create: {
        patientId,
        organizationId,
        features: features as unknown as Prisma.InputJsonValue,
        updatedByPersonId,
      },
      update: { features: features as unknown as Prisma.InputJsonValue, updatedByPersonId },
    });
    return plan.features as unknown as PatientTreatmentPlanFeatures;
  }
}
