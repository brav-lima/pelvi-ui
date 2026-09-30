import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AnamnesisStatus, AnamnesisType } from '@prisma/client';
import { AnamnesisService } from './anamnesis.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnamnesisService', () => {
  let service: AnamnesisService;
  let prisma: any;
  let tx: any;

  const orgId = 'org-1';
  const personId = 'person-1';
  const mockOrgUser = { id: 'ou-1', active: true };

  const record = (over: Record<string, unknown> = {}) => ({
    id: 'ana-1',
    organizationId: orgId,
    type: AnamnesisType.PELVIC_GENERAL,
    status: AnamnesisStatus.DRAFT,
    data: { sections: { chiefComplaint: 'Dor', currentHistory: 'Há 2 meses' } },
    ...over,
  });

  const setRecord = (row: unknown) => {
    prisma.anamnesis.findFirst.mockResolvedValue(row);
    tx.anamnesis.findFirst.mockResolvedValue(row);
  };

  beforeEach(async () => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      anamnesis: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({ id: 'ana-1' }) },
      anamnesisRevision: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      anamnesis: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      organizationUser: { findUnique: jest.fn() },
      patient: { findFirst: jest.fn() },
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AnamnesisService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AnamnesisService>(AnamnesisService);
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
      prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
      prisma.anamnesis.create.mockResolvedValue({ id: 'ana-1' });
    });

    it('cria rascunho vazio com type, professionalId do orgUser e sections vazias', async () => {
      await service.create(orgId, personId, {
        patientId: 'patient-1',
        type: AnamnesisType.PELVIC_GENERAL,
      });

      expect(prisma.organizationUser.findUnique).toHaveBeenCalledWith({
        where: { organizationId_personId: { organizationId: orgId, personId } },
      });
      expect(prisma.anamnesis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            patientId: 'patient-1',
            professionalId: 'ou-1',
            type: AnamnesisType.PELVIC_GENERAL,
            data: { sections: {} },
          }),
        }),
      );
    });

    it('persiste seções iniciais e a data da avaliação', async () => {
      await service.create(orgId, personId, {
        patientId: 'patient-1',
        type: AnamnesisType.PREGNANCY,
        assessmentDate: '2026-06-10',
        data: { sections: { obstetricHistory: 'G2P1' } },
      });

      expect(prisma.anamnesis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assessmentDate: new Date('2026-06-10'),
            data: { sections: { obstetricHistory: 'G2P1' } },
          }),
        }),
      );
    });

    it('rejeita paciente de outra organização (escopo por organizationId)', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.create(orgId, personId, { patientId: 'patient-x', type: AnamnesisType.PELVIC_GENERAL }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'patient-x', organizationId: orgId, deletedAt: null },
        }),
      );
      expect(prisma.anamnesis.create).not.toHaveBeenCalled();
    });

    it('rejeita seção desconhecida', async () => {
      await expect(
        service.create(orgId, personId, {
          patientId: 'patient-1',
          type: AnamnesisType.PELVIC_GENERAL,
          data: { sections: { ultrasound: {} } },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.anamnesis.create).not.toHaveBeenCalled();
    });

    it('lança ForbiddenException quando orgUser não existe ou está inativo', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue(null);
      await expect(
        service.create(orgId, personId, { patientId: 'patient-1', type: AnamnesisType.PELVIC_GENERAL }),
      ).rejects.toThrow(ForbiddenException);

      prisma.organizationUser.findUnique.mockResolvedValue({ ...mockOrgUser, active: false });
      await expect(
        service.create(orgId, personId, { patientId: 'patient-1', type: AnamnesisType.PELVIC_GENERAL }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.anamnesis.create).not.toHaveBeenCalled();
    });
  });

  describe('findByPatient', () => {
    it('filtra por organizationId e patientId', async () => {
      prisma.anamnesis.findMany.mockResolvedValue([]);

      await service.findByPatient(orgId, 'patient-1');

      expect(prisma.anamnesis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId, patientId: 'patient-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findById', () => {
    it('retorna a anamnese quando pertence à organização', async () => {
      const ana = record();
      prisma.anamnesis.findFirst.mockResolvedValue(ana);

      const result = await service.findById(orgId, 'ana-1');

      expect(prisma.anamnesis.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ana-1', organizationId: orgId } }),
      );
      expect(result).toEqual(ana);
    });

    it('lança NotFoundException quando não encontrada ou de outra organização', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(null);
      await expect(service.findById(orgId, 'ana-outra')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.organizationUser.findUnique.mockResolvedValue(mockOrgUser);
    });

    it('faz merge por seção preservando seções não enviadas (rascunho não gera revisão)', async () => {
      setRecord(record());

      await service.update(orgId, personId, 'ana-1', {
        data: { sections: { chiefComplaint: 'Dor intensa' } },
      });

      expect(tx.anamnesis.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ana-1' },
          data: { data: { sections: { chiefComplaint: 'Dor intensa', currentHistory: 'Há 2 meses' } } },
        }),
      );
      expect(tx.anamnesisRevision.create).not.toHaveBeenCalled();
    });

    it('string vazia sobrescreve o texto anterior (limpar um campo)', async () => {
      setRecord(record());

      await service.update(orgId, personId, 'ana-1', { data: { sections: { chiefComplaint: '' } } });

      expect(tx.anamnesis.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { data: { sections: { chiefComplaint: '', currentHistory: 'Há 2 meses' } } },
        }),
      );
    });

    it('finalizar define status COMPLETED e completedAt', async () => {
      setRecord(record());

      await service.update(orgId, personId, 'ana-1', { status: AnamnesisStatus.COMPLETED });

      expect(tx.anamnesis.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AnamnesisStatus.COMPLETED,
            completedAt: expect.any(Date),
          }),
        }),
      );
      expect(tx.anamnesisRevision.create).not.toHaveBeenCalled();
    });

    it('editar anamnese finalizada grava revisão com o data anterior e o editor, antes do update', async () => {
      const before = { sections: { chiefComplaint: 'Dor', currentHistory: 'Há 2 meses' } };
      setRecord(
        record({ status: AnamnesisStatus.COMPLETED, data: before }),
      );

      await service.update(orgId, personId, 'ana-1', {
        data: { sections: { chiefComplaint: 'Dor leve' } },
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.anamnesisRevision.create).toHaveBeenCalledWith({
        data: { organizationId: orgId, anamnesisId: 'ana-1', professionalId: 'ou-1', data: before },
      });
      const updateArg = tx.anamnesis.update.mock.calls[0][0];
      expect(updateArg.data).not.toHaveProperty('status');
      expect(tx.anamnesisRevision.create.mock.invocationCallOrder[0]).toBeLessThan(
        tx.anamnesis.update.mock.invocationCallOrder[0],
      );
    });

    it('alterar só a data da avaliação de uma anamnese finalizada também gera revisão', async () => {
      setRecord(record({ status: AnamnesisStatus.COMPLETED }));

      await service.update(orgId, personId, 'ana-1', { assessmentDate: '2026-07-01' });

      expect(tx.anamnesisRevision.create).toHaveBeenCalledTimes(1);
      expect(tx.anamnesis.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { assessmentDate: new Date('2026-07-01') } }),
      );
    });

    it('PATCH sem mudança real numa anamnese finalizada não cria revisão nem atualiza', async () => {
      const existing = record({ status: AnamnesisStatus.COMPLETED });
      setRecord(existing);

      const result = await service.update(orgId, personId, 'ana-1', {
        status: AnamnesisStatus.COMPLETED,
      });

      expect(result).toBe(existing);
      expect(tx.anamnesisRevision.create).not.toHaveBeenCalled();
      expect(tx.anamnesis.update).not.toHaveBeenCalled();
    });

    it('COMPLETED + data idêntico → sem revisão nem update', async () => {
      setRecord(record({ status: AnamnesisStatus.COMPLETED }));

      await service.update(orgId, personId, 'ana-1', {
        data: { sections: { chiefComplaint: 'Dor', currentHistory: 'Há 2 meses' } },
      });

      expect(tx.anamnesisRevision.create).not.toHaveBeenCalled();
      expect(tx.anamnesis.update).not.toHaveBeenCalled();
    });

    it('COMPLETED + assessmentDate idêntica → sem revisão nem update', async () => {
      setRecord(
        record({ status: AnamnesisStatus.COMPLETED, assessmentDate: new Date('2026-07-01') }),
      );

      await service.update(orgId, personId, 'ana-1', { assessmentDate: '2026-07-01' });

      expect(tx.anamnesisRevision.create).not.toHaveBeenCalled();
      expect(tx.anamnesis.update).not.toHaveBeenCalled();
    });

    it('COMPLETED + uma seção alterada → cria revisão', async () => {
      setRecord(record({ status: AnamnesisStatus.COMPLETED }));

      await service.update(orgId, personId, 'ana-1', {
        data: { sections: { chiefComplaint: 'Outra' } },
      });

      expect(tx.anamnesisRevision.create).toHaveBeenCalledTimes(1);
      expect(tx.anamnesis.update).toHaveBeenCalledTimes(1);
    });

    it('DRAFT + data idêntico → sem revisão e sem update', async () => {
      setRecord(record());

      await service.update(orgId, personId, 'ana-1', {
        data: { sections: { chiefComplaint: 'Dor' } },
      });

      expect(tx.anamnesisRevision.create).not.toHaveBeenCalled();
      expect(tx.anamnesis.update).not.toHaveBeenCalled();
    });

    it('bloqueia a linha (FOR UPDATE) e usa a releitura dentro da transação para merge e revisão', async () => {
      const stale = record({
        status: AnamnesisStatus.COMPLETED,
        data: { sections: { chiefComplaint: 'Velho' } },
      });
      const fresh = record({
        status: AnamnesisStatus.COMPLETED,
        data: { sections: { chiefComplaint: 'Novo', healthHistory: 'HP' } },
      });
      prisma.anamnesis.findFirst.mockResolvedValue(stale);
      tx.anamnesis.findFirst.mockResolvedValue(fresh);

      await service.update(orgId, personId, 'ana-1', {
        data: { sections: { currentHistory: 'X' } },
      });

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.anamnesis.findFirst.mock.invocationCallOrder[0],
      );
      expect(tx.anamnesis.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ana-1', organizationId: orgId } }),
      );
      expect(tx.anamnesisRevision.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          anamnesisId: 'ana-1',
          professionalId: 'ou-1',
          data: fresh.data,
        },
      });
      expect(tx.anamnesis.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            data: {
              sections: { chiefComplaint: 'Novo', healthHistory: 'HP', currentHistory: 'X' },
            },
          },
        }),
      );
    });

    it('releitura dentro da transação sem registro → 404 sem escrever', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record());
      tx.anamnesis.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, personId, 'ana-1', { data: { sections: { chiefComplaint: 'x' } } }),
      ).rejects.toThrow(NotFoundException);
      expect(tx.anamnesis.update).not.toHaveBeenCalled();
    });

    it('reabrir detectado só na releitura (finalizada por outro writer) → 400 sem escrever', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record());
      tx.anamnesis.findFirst.mockResolvedValue(record({ status: AnamnesisStatus.COMPLETED }));

      await expect(
        service.update(orgId, personId, 'ana-1', { status: AnamnesisStatus.DRAFT }),
      ).rejects.toThrow(BadRequestException);
      expect(tx.anamnesis.update).not.toHaveBeenCalled();
      expect(tx.anamnesisRevision.create).not.toHaveBeenCalled();
    });

    it('não permite reabrir anamnese finalizada como rascunho', async () => {
      setRecord(record({ status: AnamnesisStatus.COMPLETED }));

      await expect(
        service.update(orgId, personId, 'ana-1', { status: AnamnesisStatus.DRAFT }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('registro legado (type null) é somente leitura → 409', async () => {
      setRecord(
        record({ type: null, status: AnamnesisStatus.COMPLETED, data: { queixaPrincipal: {} } }),
      );

      await expect(
        service.update(orgId, personId, 'ana-1', { data: { sections: {} } }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejeita seção desconhecida sem abrir transação', async () => {
      setRecord(record());

      await expect(
        service.update(orgId, personId, 'ana-1', { data: { sections: { foo: 'x' } } }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando a anamnese não existe na org (tenant isolation)', async () => {
      setRecord(null);

      await expect(
        service.update(orgId, personId, 'ana-outra', { data: { sections: {} } }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.anamnesis.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ana-outra', organizationId: orgId } }),
      );
    });

    it('lança ForbiddenException quando o orgUser está inativo', async () => {
      setRecord(record());
      prisma.organizationUser.findUnique.mockResolvedValue({ ...mockOrgUser, active: false });

      await expect(
        service.update(orgId, personId, 'ana-1', { data: { sections: {} } }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('exclui rascunho', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record());
      prisma.anamnesis.delete.mockResolvedValue({ id: 'ana-1' });

      await service.remove(orgId, 'ana-1');

      expect(prisma.anamnesis.delete).toHaveBeenCalledWith({ where: { id: 'ana-1' } });
    });

    it('não exclui anamnese finalizada (nem legado backfilled) → 409', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(record({ status: AnamnesisStatus.COMPLETED }));

      await expect(service.remove(orgId, 'ana-1')).rejects.toThrow(ConflictException);
      expect(prisma.anamnesis.delete).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando não existe na org', async () => {
      prisma.anamnesis.findFirst.mockResolvedValue(null);
      await expect(service.remove(orgId, 'ana-x')).rejects.toThrow(NotFoundException);
      expect(prisma.anamnesis.delete).not.toHaveBeenCalled();
    });
  });
});
