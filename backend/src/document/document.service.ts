import type { Readable } from 'stream';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DOCUMENT_STORAGE } from './storage/document-storage.token';
import type { IDocumentStorage } from './storage/document-storage.interface';
import type { UploadDocumentDto } from './dto/upload-document.dto';
import type { UpdateDocumentDto } from './dto/update-document.dto';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCUMENT_STORAGE) private readonly storage: IDocumentStorage,
  ) {}

  findAll(orgId: string) {
    return this.prisma.clinicDocument.findMany({
      where: {
        // SEMPRE incluir documentos de sistema (organizationId: null).
        OR: [{ organizationId: orgId }, { organizationId: null }],
        active: true,
      },
      orderBy: [{ organizationId: 'asc' }, { name: 'asc' }],
    });
  }

  async upload(
    orgId: string,
    createdBy: string,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');

    const result = await this.storage.upload(orgId, file.buffer, file.mimetype);

    return this.prisma.clinicDocument.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        type: 'FILE',
        fileKey: result.fileKey,
        mimeType: result.mimeType,
        fileSize: result.fileSize,
        createdBy,
      },
    });
  }

  async download(orgId: string, id: string): Promise<StreamableFile> {
    const doc = await this.findAndAuthorize(orgId, id);

    if (doc.type !== 'FILE' || !doc.fileKey) {
      throw new BadRequestException('Documento não é um arquivo para download');
    }

    const stream = await this.storage.getStream(doc.fileKey) as Readable;

    return new StreamableFile(stream, {
      type: doc.mimeType ?? 'application/pdf',
      disposition: `inline; filename="${encodeURIComponent(doc.name)}.pdf"`,
    });
  }

  async update(orgId: string, id: string, dto: UpdateDocumentDto) {
    const doc = await this.findAndAuthorize(orgId, id);

    if (doc.organizationId === null) {
      throw new ForbiddenException('Documentos de sistema não podem ser editados');
    }

    return this.prisma.clinicDocument.update({
      where: { id },
      data: dto,
    });
  }

  async softDelete(orgId: string, id: string): Promise<void> {
    const doc = await this.findAndAuthorize(orgId, id);

    if (doc.organizationId === null) {
      throw new ForbiddenException('Documentos de sistema não podem ser removidos');
    }

    await this.prisma.clinicDocument.update({
      where: { id },
      data: { active: false },
    });

    // Fire-and-forget — não bloqueia a resposta. Falha logada, não propagada.
    if (doc.fileKey) {
      this.storage.delete(doc.fileKey).catch((err) =>
        this.logger.error({ msg: 'storage_delete_failed', fileKey: doc.fileKey, err }),
      );
    }
  }

  async findAndAuthorize(orgId: string, id: string) {
    const doc = await this.prisma.clinicDocument.findFirst({
      where: {
        id,
        OR: [{ organizationId: orgId }, { organizationId: null }],
        active: true,
      },
    });

    if (!doc) throw new NotFoundException('Documento não encontrado');
    return doc;
  }
}
