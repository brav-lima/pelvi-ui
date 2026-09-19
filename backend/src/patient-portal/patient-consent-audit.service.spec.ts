import { Test, TestingModule } from '@nestjs/testing';
import { PatientConsentAuditService } from './patient-consent-audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientConsentAuditService', () => {
  let service: PatientConsentAuditService;
  let prisma: { patientConsentAudit: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = { patientConsentAudit: { create: jest.fn().mockResolvedValue({}) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PatientConsentAuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PatientConsentAuditService>(PatientConsentAuditService);
  });

  it('grava uma linha de auditoria', async () => {
    await service.record({
      patientAccountLinkId: 'link-1',
      action: 'REQUESTED',
      actorType: 'PROFESSIONAL',
      actorId: 'person-1',
    });

    expect(prisma.patientConsentAudit.create).toHaveBeenCalledWith({
      data: {
        patientAccountLinkId: 'link-1',
        action: 'REQUESTED',
        actorType: 'PROFESSIONAL',
        actorId: 'person-1',
      },
    });
  });
});
