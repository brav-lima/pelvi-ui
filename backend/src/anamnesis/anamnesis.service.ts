import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { AnamnesisStatus, AnamnesisType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnamnesisDto } from './dto/create-anamnesis.dto';
import { UpdateAnamnesisDto } from './dto/update-anamnesis.dto';
import { extractSections, normalizeAnamnesisData } from './anamnesis-sections';

const INCLUDE = {
  patient: { select: { id: true, name: true } },
  professional: { include: { person: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class AnamnesisService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, personId: string, dto: CreateAnamnesisDto) {
    const orgUser = await this.resolveOrgUser(organizationId, personId);

    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }

    const data = normalizeAnamnesisData(dto.type, dto.data);

    return this.prisma.anamnesis.create({
      data: {
        organizationId,
        patientId: dto.patientId,
        professionalId: orgUser.id,
        type: dto.type,
        assessmentDate: dto.assessmentDate ? new Date(dto.assessmentDate) : undefined,
        data: data as Prisma.InputJsonValue,
        ...(dto.legalBasis && { legalBasis: dto.legalBasis }),
        ...(dto.consentId && { consentId: dto.consentId }),
        ...(dto.legalBasisNotes && { legalBasisNotes: dto.legalBasisNotes }),
      },
      include: INCLUDE,
    });
  }

  async findByPatient(organizationId: string, patientId: string) {
    return this.prisma.anamnesis.findMany({
      where: { organizationId, patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        professional: { include: { person: { select: { id: true, name: true } } } },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    const anamnesis = await this.prisma.anamnesis.findFirst({
      where: { id, organizationId },
      include: INCLUDE,
    });

    if (!anamnesis) {
      throw new NotFoundException('Anamnese não encontrada');
    }

    return anamnesis;
  }

  async update(
    organizationId: string,
    personId: string,
    id: string,
    dto: UpdateAnamnesisDto,
  ) {
    // Cheap early exits on immutable/validation concerns (no writes yet).
    const preliminary = await this.findById(organizationId, id);
    this.assertEditable(preliminary, dto);
    const incoming =
      dto.data !== undefined
        ? normalizeAnamnesisData(preliminary.type as AnamnesisType, dto.data)
        : undefined;
    const orgUser = await this.resolveOrgUser(organizationId, personId);

    return this.prisma.$transaction(async (tx) => {
      // Serialize concurrent writers on this row, then decide from a fresh read.
      await tx.$queryRaw`SELECT id FROM anamneses WHERE id = ${id} AND organization_id = ${organizationId} FOR UPDATE`;
      const existing = await tx.anamnesis.findFirst({
        where: { id, organizationId },
        include: INCLUDE,
      });
      if (!existing) {
        throw new NotFoundException('Anamnese não encontrada');
      }
      this.assertEditable(existing, dto);

      const currentSections = extractSections(existing.data);
      let nextData: Prisma.InputJsonValue | undefined;
      if (incoming !== undefined) {
        const merged = { ...currentSections, ...incoming.sections };
        if (!isDeepStrictEqual(merged, currentSections)) {
          nextData = { sections: merged } as Prisma.InputJsonValue;
        }
      }

      let nextDate: Date | undefined;
      if (dto.assessmentDate !== undefined) {
        const candidate = new Date(dto.assessmentDate);
        if (existing.assessmentDate?.getTime() !== candidate.getTime()) {
          nextDate = candidate;
        }
      }

      const finalizing =
        dto.status === AnamnesisStatus.COMPLETED && existing.status === AnamnesisStatus.DRAFT;

      if (nextData === undefined && nextDate === undefined && !finalizing) {
        return existing;
      }

      if (existing.status === AnamnesisStatus.COMPLETED) {
        await tx.anamnesisRevision.create({
          data: {
            organizationId,
            anamnesisId: id,
            professionalId: orgUser.id,
            data: (existing.data ?? {}) as Prisma.InputJsonValue,
            assessmentDate: existing.assessmentDate ?? null,
          },
        });
      }

      return tx.anamnesis.update({
        where: { id },
        data: {
          ...(nextData !== undefined && { data: nextData }),
          ...(nextDate !== undefined && { assessmentDate: nextDate }),
          ...(finalizing && {
            status: AnamnesisStatus.COMPLETED,
            completedAt: new Date(),
          }),
        },
        include: INCLUDE,
      });
    });
  }

  private assertEditable(
    row: { type: AnamnesisType | null; status: AnamnesisStatus },
    dto: UpdateAnamnesisDto,
  ) {
    if (row.type === null) {
      throw new ConflictException('Anamnese em formato anterior é somente leitura');
    }
    if (dto.status === AnamnesisStatus.DRAFT && row.status === AnamnesisStatus.COMPLETED) {
      throw new BadRequestException('Anamnese finalizada não pode voltar a rascunho');
    }
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.findById(organizationId, id);
    const message = 'Anamnese em formato anterior ou finalizada não pode ser excluída';

    if (existing.type === null || existing.status === AnamnesisStatus.COMPLETED) {
      throw new ConflictException(message);
    }

    // Re-check the guard atomically: a concurrent finalize must not let a COMPLETED row be deleted.
    const { count } = await this.prisma.anamnesis.deleteMany({
      where: {
        id,
        organizationId,
        status: AnamnesisStatus.DRAFT,
        type: { not: null },
      },
    });
    if (count === 0) {
      throw new ConflictException(message);
    }
    return existing;
  }

  private async resolveOrgUser(organizationId: string, personId: string) {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: { organizationId_personId: { organizationId, personId } },
    });

    if (!orgUser || !orgUser.active) {
      throw new ForbiddenException('Vínculo com a clínica não encontrado');
    }

    return orgUser;
  }
}
