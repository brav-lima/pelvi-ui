import { Test, TestingModule } from '@nestjs/testing';
import { PatientTreatmentPlanService } from './patient-treatment-plan.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientTreatmentPlanService', () => {
  let service: PatientTreatmentPlanService;
  let prisma: { patientTreatmentPlan: { findFirst: jest.Mock; upsert: jest.Mock } };

  beforeEach(async () => {
    prisma = { patientTreatmentPlan: { findFirst: jest.fn(), upsert: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PatientTreatmentPlanService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PatientTreatmentPlanService>(PatientTreatmentPlanService);
  });

  it('retorna os recursos padrão (tudo desligado) quando não há plano', async () => {
    prisma.patientTreatmentPlan.findFirst.mockResolvedValue(null);

    const result = await service.getForPatient('org-1', 'patient-1');

    expect(result).toEqual({ diarioMiccional: false, diarioEvacuatorio: false, cronometros: false });
  });

  it('retorna os recursos salvos quando há plano', async () => {
    prisma.patientTreatmentPlan.findFirst.mockResolvedValue({
      features: { diarioMiccional: true, diarioEvacuatorio: false, cronometros: true },
    });

    const result = await service.getForPatient('org-1', 'patient-1');

    expect(result).toEqual({ diarioMiccional: true, diarioEvacuatorio: false, cronometros: true });
  });

  it('faz upsert dos recursos e retorna o resultado salvo', async () => {
    const features = { diarioMiccional: true, diarioEvacuatorio: true, cronometros: false };
    prisma.patientTreatmentPlan.upsert.mockResolvedValue({ features });

    const result = await service.upsertFeatures('org-1', 'patient-1', features, 'person-1');

    expect(prisma.patientTreatmentPlan.upsert).toHaveBeenCalledWith({
      where: { patientId: 'patient-1' },
      create: { patientId: 'patient-1', organizationId: 'org-1', features, updatedByPersonId: 'person-1' },
      update: { features, updatedByPersonId: 'person-1' },
    });
    expect(result).toEqual(features);
  });
});
