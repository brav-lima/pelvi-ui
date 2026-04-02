import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: { auditLog: any };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('log', () => {
    it('deve persistir entrada de auditoria com todos os campos', async () => {
      const entry = {
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'CREATE',
        entity: 'Patient',
        entityId: 'patient-1',
        details: { name: 'Maria' },
        ipAddress: '127.0.0.1',
      };

      await service.log(entry);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          userId: 'user-1',
          action: 'CREATE',
          entity: 'Patient',
          entityId: 'patient-1',
          details: { name: 'Maria' },
          ipAddress: '127.0.0.1',
        },
      });
    });

    it('deve persistir entrada sem campos opcionais', async () => {
      await service.log({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'DELETE',
        entity: 'Appointment',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'DELETE',
          entity: 'Appointment',
          entityId: undefined,
          details: undefined,
          ipAddress: undefined,
        }),
      });
    });
  });
});
