import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AgendaBlockService } from './agenda-block.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AgendaBlockService', () => {
  let service: AgendaBlockService;
  let prisma: {
    agendaBlock: any;
    appointment: any;
    organizationUser: any;
  };

  const orgId = 'org-1';
  const personId = 'person-1';
  const ownOrgUser = { id: 'org-user-1', organizationId: orgId, personId, active: true };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      agendaBlock: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      appointment: {
        findFirst: jest.fn(),
      },
      organizationUser: {
        findUnique: jest.fn().mockResolvedValue(ownOrgUser),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AgendaBlockService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AgendaBlockService>(AgendaBlockService);
  });

  describe('create', () => {
    const dto = {
      professionalId: ownOrgUser.id,
      title: 'Consulta odontológica',
      startAt: '2026-09-01T10:00:00.000Z',
      endAt: '2026-09-01T11:00:00.000Z',
    };

    it('creates a block for own agenda when role is PROFESSIONAL', async () => {
      prisma.agendaBlock.findFirst.mockResolvedValue(null);
      prisma.appointment.findFirst.mockResolvedValue(null);
      prisma.agendaBlock.create.mockResolvedValue({ id: 'block-1', organizationId: orgId, ...dto });

      const result = await service.create(orgId, personId, 'PROFESSIONAL', dto);

      expect(result.id).toBe('block-1');
      expect(prisma.agendaBlock.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          professionalId: dto.professionalId,
          title: dto.title,
          startAt: new Date(dto.startAt),
          endAt: new Date(dto.endAt),
          notes: undefined,
        },
      });
    });

    it('rejects a PROFESSIONAL blocking someone else\'s agenda', async () => {
      await expect(
        service.create(orgId, personId, 'PROFESSIONAL', { ...dto, professionalId: 'other-prof' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.agendaBlock.create).not.toHaveBeenCalled();
    });

    it('allows ADMIN to block any professional\'s agenda', async () => {
      prisma.agendaBlock.findFirst.mockResolvedValue(null);
      prisma.appointment.findFirst.mockResolvedValue(null);
      prisma.agendaBlock.create.mockResolvedValue({ id: 'block-1' });

      await service.create(orgId, personId, 'ADMIN', { ...dto, professionalId: 'other-prof' });

      expect(prisma.agendaBlock.create).toHaveBeenCalled();
    });

    it('throws ConflictException when another block overlaps', async () => {
      prisma.agendaBlock.findFirst.mockResolvedValue({ id: 'existing-block' });

      await expect(service.create(orgId, personId, 'PROFESSIONAL', dto)).rejects.toThrow(ConflictException);
      expect(prisma.agendaBlock.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when an appointment overlaps', async () => {
      prisma.agendaBlock.findFirst.mockResolvedValue(null);
      prisma.appointment.findFirst.mockResolvedValue({ id: 'existing-appointment' });

      await expect(service.create(orgId, personId, 'PROFESSIONAL', dto)).rejects.toThrow(ConflictException);
      expect(prisma.agendaBlock.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when endAt is before startAt', async () => {
      await expect(
        service.create(orgId, personId, 'PROFESSIONAL', {
          ...dto,
          startAt: '2026-09-01T11:00:00.000Z',
          endAt: '2026-09-01T10:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.agendaBlock.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('lists blocks scoped to the organization and date range', async () => {
      prisma.agendaBlock.findMany.mockResolvedValue([{ id: 'block-1' }]);

      const result = await service.findAll(orgId, {
        startDate: '2026-09-01',
        endDate: '2026-09-02',
      });

      expect(result).toEqual([{ id: 'block-1' }]);
      expect(prisma.agendaBlock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: orgId }) }),
      );
    });
  });

  describe('update', () => {
    it('rejects a PROFESSIONAL editing another professional\'s block', async () => {
      prisma.agendaBlock.findFirst.mockResolvedValue({
        id: 'block-1',
        organizationId: orgId,
        professionalId: 'other-prof',
      });

      await expect(
        service.update(orgId, personId, 'PROFESSIONAL', 'block-1', { title: 'x' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.agendaBlock.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when block does not belong to org', async () => {
      prisma.agendaBlock.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, personId, 'ADMIN', 'missing', { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when endAt is before startAt', async () => {
      prisma.agendaBlock.findFirst.mockResolvedValue({
        id: 'block-1',
        organizationId: orgId,
        professionalId: ownOrgUser.id,
        startAt: new Date('2026-09-01T10:00:00.000Z'),
        endAt: new Date('2026-09-01T11:00:00.000Z'),
      });

      await expect(
        service.update(orgId, personId, 'PROFESSIONAL', 'block-1', {
          startAt: '2026-09-01T11:00:00.000Z',
          endAt: '2026-09-01T10:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.agendaBlock.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('rejects a PROFESSIONAL deleting another professional\'s block', async () => {
      prisma.agendaBlock.findFirst.mockResolvedValue({
        id: 'block-1',
        organizationId: orgId,
        professionalId: 'other-prof',
      });

      await expect(service.remove(orgId, personId, 'PROFESSIONAL', 'block-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.agendaBlock.delete).not.toHaveBeenCalled();
    });

    it('deletes when owner matches', async () => {
      prisma.agendaBlock.findFirst.mockResolvedValue({
        id: 'block-1',
        organizationId: orgId,
        professionalId: ownOrgUser.id,
      });
      prisma.agendaBlock.delete.mockResolvedValue({ id: 'block-1' });

      await service.remove(orgId, personId, 'PROFESSIONAL', 'block-1');

      expect(prisma.agendaBlock.delete).toHaveBeenCalledWith({ where: { id: 'block-1' } });
    });
  });
});
