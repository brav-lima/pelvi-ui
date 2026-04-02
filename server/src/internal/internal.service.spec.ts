import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { InternalService } from './internal.service';
import { PrismaService } from '../prisma/prisma.service';

describe('InternalService', () => {
  let service: InternalService;
  let prisma: { organization: any };

  const mockClinic = {
    id: 'org-1',
    name: 'Clínica A',
    cnpj: '12345678000199',
    email: 'a@clinica.com',
    phone: '11999990000',
    accessStatus: 'ACTIVE',
    planMaxUsers: null,
    planMaxPatients: null,
  };

  beforeEach(async () => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InternalService>(InternalService);
  });

  describe('createClinic', () => {
    const dto = {
      name: 'Clínica A',
      document: '12345678000199',
      email: 'a@clinica.com',
      phone: '11999990000',
    };

    it('deve lançar ConflictException quando organização já existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);

      await expect(service.createClinic(dto)).rejects.toThrow(ConflictException);
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });

    it('deve criar clínica e retornar clinicId', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      prisma.organization.create.mockResolvedValue(mockClinic);

      const result = await service.createClinic(dto);

      expect(prisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: dto.name, cnpj: dto.document }),
        }),
      );
      expect(result).toEqual({ clinicId: mockClinic.id });
    });
  });

  describe('listClinics', () => {
    it('deve listar clínicas no formato de resposta da API interna', async () => {
      prisma.organization.findMany.mockResolvedValue([mockClinic]);

      const result = await service.listClinics();

      expect(result).toEqual([
        {
          clinicId: 'org-1',
          name: 'Clínica A',
          document: '12345678000199',
          email: 'a@clinica.com',
          phone: '11999990000',
          accessStatus: 'ACTIVE',
        },
      ]);
    });
  });

  describe('updateClinicAccess', () => {
    it('deve lançar NotFoundException quando clínica não existe', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.updateClinicAccess('org-inexistente', 'BLOCKED'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('deve atualizar status de acesso sem limites opcionais', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);
      prisma.organization.update.mockResolvedValue({ ...mockClinic, accessStatus: 'BLOCKED' });

      const result = await service.updateClinicAccess('org-1', 'BLOCKED');

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: expect.objectContaining({ accessStatus: 'BLOCKED' }),
        }),
      );
      expect(result.accessStatus).toBe('BLOCKED');
    });

    it('deve incluir planMaxUsers e planMaxPatients quando informados', async () => {
      prisma.organization.findUnique.mockResolvedValue(mockClinic);
      prisma.organization.update.mockResolvedValue({
        ...mockClinic,
        accessStatus: 'ACTIVE',
        planMaxUsers: 10,
        planMaxPatients: 50,
      });

      await service.updateClinicAccess('org-1', 'ACTIVE', 10, 50);

      const callData = prisma.organization.update.mock.calls[0][0].data;
      expect(callData.planMaxUsers).toBe(10);
      expect(callData.planMaxPatients).toBe(50);
    });
  });
});
