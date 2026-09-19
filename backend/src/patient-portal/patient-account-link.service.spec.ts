import { Test, TestingModule } from '@nestjs/testing';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientAccountLinkService', () => {
  let service: PatientAccountLinkService;
  let prisma: {
    patientAccountLink: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      patientAccountLink: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PatientAccountLinkService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PatientAccountLinkService>(PatientAccountLinkService);
  });

  it('busca vínculo por patientId', async () => {
    prisma.patientAccountLink.findFirst.mockResolvedValue({ id: 'link-1' });

    const result = await service.findByPatientId('patient-1');

    expect(result).toEqual({ id: 'link-1' });
    expect(prisma.patientAccountLink.findFirst).toHaveBeenCalledWith({ where: { patientId: 'patient-1' } });
  });

  it('busca vínculo por id', async () => {
    prisma.patientAccountLink.findUnique.mockResolvedValue({ id: 'link-1' });

    const result = await service.findById('link-1');

    expect(result).toEqual({ id: 'link-1' });
    expect(prisma.patientAccountLink.findUnique).toHaveBeenCalledWith({ where: { id: 'link-1' } });
  });

  it('lista todos os vínculos de uma conta', async () => {
    prisma.patientAccountLink.findMany.mockResolvedValue([{ id: 'link-1' }, { id: 'link-2' }]);

    const result = await service.findAllByAccountId('acc-1');

    expect(result).toHaveLength(2);
    expect(prisma.patientAccountLink.findMany).toHaveBeenCalledWith({
      where: { patientAccountId: 'acc-1' },
    });
  });

  it('cria um vínculo pendente de consentimento', async () => {
    prisma.patientAccountLink.create.mockResolvedValue({ id: 'link-1', status: 'PENDING_CONSENT' });

    const result = await service.create({
      patientAccountId: 'acc-1',
      patientId: 'patient-1',
      organizationId: 'org-1',
    });

    expect(prisma.patientAccountLink.create).toHaveBeenCalledWith({
      data: { patientAccountId: 'acc-1', patientId: 'patient-1', organizationId: 'org-1' },
    });
    expect(result.status).toBe('PENDING_CONSENT');
  });

  it('atualiza o status do vínculo, com confirmedAt opcional', async () => {
    prisma.patientAccountLink.update.mockResolvedValue({ id: 'link-1', status: 'ACTIVE' });

    await service.updateStatus('link-1', 'ACTIVE', new Date('2026-09-18'));

    expect(prisma.patientAccountLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { status: 'ACTIVE', confirmedAt: new Date('2026-09-18') },
    });
  });

  it('atualiza o status sem tocar em confirmedAt quando não informado', async () => {
    prisma.patientAccountLink.update.mockResolvedValue({ id: 'link-1', status: 'DECLINED' });

    await service.updateStatus('link-1', 'DECLINED');

    expect(prisma.patientAccountLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { status: 'DECLINED', confirmedAt: undefined },
    });
  });
});
