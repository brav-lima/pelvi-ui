import { Test, TestingModule } from '@nestjs/testing';
import { PatientLookupService } from './patient-lookup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientLookupService', () => {
  let service: PatientLookupService;
  let prisma: { patient: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = { patient: { findFirst: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientLookupService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PatientLookupService>(PatientLookupService);
  });

  it('retorna os dados enxutos da paciente e da clínica quando encontrada', async () => {
    prisma.patient.findFirst.mockResolvedValue({
      id: 'patient-1',
      name: 'Maria Silva',
      cpf: '12345678901',
      phone: '11999998888',
      birthDate: new Date('1990-01-01'),
      email: 'maria@email.com',
      organizationId: 'org-1',
      organization: { name: 'Clínica A' },
    });

    const result = await service.findById('patient-1');

    expect(result).toEqual({
      id: 'patient-1',
      name: 'Maria Silva',
      cpf: '12345678901',
      phone: '11999998888',
      birthDate: new Date('1990-01-01'),
      email: 'maria@email.com',
      organizationId: 'org-1',
      organizationName: 'Clínica A',
    });
    expect(prisma.patient.findFirst).toHaveBeenCalledWith({
      where: { id: 'patient-1', deletedAt: null },
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
  });

  it('retorna null quando a paciente não existe', async () => {
    prisma.patient.findFirst.mockResolvedValue(null);

    const result = await service.findById('nope');

    expect(result).toBeNull();
  });
});
