import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { DocumentService } from './document.service';
import { PrismaService } from '../prisma/prisma.service';
import { DOCUMENT_STORAGE } from './storage/document-storage.token';

const orgId = 'org-1';
const otherOrgId = 'org-2';

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc-1',
  organizationId: orgId,
  name: 'Relatório',
  description: null,
  category: null,
  type: 'FILE' as const,
  fileKey: `${orgId}/uuid.pdf`,
  mimeType: 'application/pdf',
  fileSize: 1024,
  templateType: null,
  active: true,
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('DocumentService', () => {
  let service: DocumentService;
  let prisma: { clinicDocument: Record<string, jest.Mock> };
  let storage: { upload: jest.Mock; getStream: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    prisma = {
      clinicDocument: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    storage = {
      upload: jest.fn(),
      getStream: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: PrismaService, useValue: prisma },
        { provide: DOCUMENT_STORAGE, useValue: storage },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
  });

  // ── findAll ────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('deve chamar findMany com OR incluindo documentos de sistema', async () => {
      prisma.clinicDocument.findMany.mockResolvedValue([]);
      await service.findAll(orgId);

      expect(prisma.clinicDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ organizationId: orgId }, { organizationId: null }],
            active: true,
          }),
        }),
      );
    });

    it('deve retornar documentos da org e documentos de sistema', async () => {
      const docs = [
        makeDoc({ organizationId: orgId }),
        makeDoc({ id: 'sys-1', organizationId: null }),
      ];
      prisma.clinicDocument.findMany.mockResolvedValue(docs);

      const result = await service.findAll(orgId);
      expect(result).toHaveLength(2);
    });

    it('não deve incluir documentos inativos na query', async () => {
      prisma.clinicDocument.findMany.mockResolvedValue([]);
      await service.findAll(orgId);

      const callArg = prisma.clinicDocument.findMany.mock.calls[0][0];
      expect(callArg.where.active).toBe(true);
    });
  });

  // ── upload ─────────────────────────────────────────────────────────────

  describe('upload', () => {
    it('deve fazer upload no storage e persistir no banco', async () => {
      const fileKey = `${orgId}/abc.pdf`;
      storage.upload.mockResolvedValue({ fileKey, fileSize: 512, mimeType: 'application/pdf' });
      prisma.clinicDocument.create.mockResolvedValue(makeDoc({ fileKey }));

      const file = { buffer: Buffer.from('pdf'), mimetype: 'application/pdf' } as Express.Multer.File;
      const dto = { name: 'Relatório' };

      const result = await service.upload(orgId, 'user-1', file, dto);
      expect(storage.upload).toHaveBeenCalledWith(orgId, file.buffer, file.mimetype);
      expect(prisma.clinicDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fileKey }) }),
      );
      expect(result).toBeDefined();
    });

    it('deve lançar BadRequestException se arquivo não enviado', async () => {
      await expect(
        service.upload(orgId, 'user-1', null as unknown as Express.Multer.File, { name: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── download ───────────────────────────────────────────────────────────

  describe('download', () => {
    it('deve retornar StreamableFile para documento FILE', async () => {
      const doc = makeDoc();
      prisma.clinicDocument.findFirst.mockResolvedValue(doc);
      storage.getStream.mockResolvedValue({ pipe: jest.fn() });

      const result = await service.download(orgId, 'doc-1');
      expect(result).toBeInstanceOf(StreamableFile);
    });

    it('deve lançar BadRequestException para documento GENERATED', async () => {
      prisma.clinicDocument.findFirst.mockResolvedValue(
        makeDoc({ type: 'GENERATED', fileKey: null }),
      );

      await expect(service.download(orgId, 'doc-1')).rejects.toThrow(BadRequestException);
    });

    it('deve lançar NotFoundException se documento não pertence à org', async () => {
      prisma.clinicDocument.findFirst.mockResolvedValue(null);

      await expect(service.download(otherOrgId, 'doc-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── softDelete ─────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('deve fazer soft delete e chamar storage.delete em background', async () => {
      const doc = makeDoc();
      prisma.clinicDocument.findFirst.mockResolvedValue(doc);
      prisma.clinicDocument.update.mockResolvedValue({ ...doc, active: false });
      storage.delete.mockResolvedValue(undefined);

      await service.softDelete(orgId, 'doc-1');
      expect(prisma.clinicDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { active: false } }),
      );
    });

    it('deve lançar ForbiddenException para documentos de sistema', async () => {
      prisma.clinicDocument.findFirst.mockResolvedValue(
        makeDoc({ organizationId: null }),
      );

      await expect(service.softDelete(orgId, 'doc-1')).rejects.toThrow(ForbiddenException);
    });

    it('não deve bloquear a resposta se storage.delete falhar', async () => {
      const doc = makeDoc();
      prisma.clinicDocument.findFirst.mockResolvedValue(doc);
      prisma.clinicDocument.update.mockResolvedValue({ ...doc, active: false });
      storage.delete.mockRejectedValue(new Error('storage error'));

      // Não deve lançar erro — falha é fire-and-forget
      await expect(service.softDelete(orgId, 'doc-1')).resolves.toBeUndefined();
    });
  });

  // ── update ─────────────────────────────────────────────────────────────

  describe('update', () => {
    it('deve atualizar documento da org', async () => {
      const doc = makeDoc();
      prisma.clinicDocument.findFirst.mockResolvedValue(doc);
      prisma.clinicDocument.update.mockResolvedValue({ ...doc, name: 'Novo Nome' });

      const result = await service.update(orgId, 'doc-1', { name: 'Novo Nome' });
      expect(result.name).toBe('Novo Nome');
    });

    it('deve lançar ForbiddenException ao tentar editar documento de sistema', async () => {
      prisma.clinicDocument.findFirst.mockResolvedValue(makeDoc({ organizationId: null }));

      await expect(service.update(orgId, 'doc-1', { name: 'x' })).rejects.toThrow(ForbiddenException);
    });
  });
});
