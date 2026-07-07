import { Test, TestingModule } from '@nestjs/testing';
import * as Sentry from '@sentry/nestjs';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

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

    it('deve emitir breadcrumb e log estruturado no Sentry sem incluir details', async () => {
      await service.log({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'CREATE',
        entity: 'Patient',
        entityId: 'patient-1',
        details: { name: 'Maria', cpf: '12345678901' },
      });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'audit',
        message: 'CREATE Patient',
        level: 'info',
        data: { entityId: 'patient-1', organizationId: 'org-1' },
      });
      expect(Sentry.logger.info).toHaveBeenCalledWith('CREATE Patient', {
        userId: 'user-1',
        organizationId: 'org-1',
        entityId: 'patient-1',
      });

      const breadcrumbData = (Sentry.addBreadcrumb as jest.Mock).mock.calls[0][0].data;
      const logMeta = (Sentry.logger.info as jest.Mock).mock.calls[0][1];
      expect(JSON.stringify(breadcrumbData)).not.toContain('Maria');
      expect(JSON.stringify(logMeta)).not.toContain('Maria');
    });

    it('deve emitir breadcrumb mesmo sem entityId', async () => {
      await service.log({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'DELETE',
        entity: 'Appointment',
      });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'audit',
        message: 'DELETE Appointment',
        level: 'info',
        data: { entityId: undefined, organizationId: 'org-1' },
      });
    });
  });
});
