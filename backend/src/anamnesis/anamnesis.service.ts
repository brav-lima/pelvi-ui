import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AnamnesisStatus, Prisma } from '@prisma/client';
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
    const existing = await this.findById(organizationId, id);

    if (existing.type === null) {
      throw new ConflictException('Anamnese em formato anterior é somente leitura');
    }
    if (
      dto.status === AnamnesisStatus.DRAFT &&
      existing.status === AnamnesisStatus.COMPLETED
    ) {
      throw new BadRequestException('Anamnese finalizada não pode voltar a rascunho');
    }

    const orgUser = await this.resolveOrgUser(organizationId, personId);

    let nextData: Prisma.InputJsonValue | undefined;
    if (dto.data !== undefined) {
      const incoming = normalizeAnamnesisData(existing.type, dto.data);
      nextData = {
        sections: { ...extractSections(existing.data), ...incoming.sections },
      } as Prisma.InputJsonValue;
    }

    const finalizing =
      dto.status === AnamnesisStatus.COMPLETED && existing.status === AnamnesisStatus.DRAFT;
    const editingCompleted =
      existing.status === AnamnesisStatus.COMPLETED &&
      (dto.data !== undefined || dto.assessmentDate !== undefined);

    if (nextData === undefined && dto.assessmentDate === undefined && !finalizing) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      if (editingCompleted) {
        await tx.anamnesisRevision.create({
          data: {
            organizationId,
            anamnesisId: id,
            professionalId: orgUser.id,
            data: (existing.data ?? {}) as Prisma.InputJsonValue,
          },
        });
      }

      return tx.anamnesis.update({
        where: { id },
        data: {
          ...(nextData !== undefined && { data: nextData }),
          ...(dto.assessmentDate !== undefined && {
            assessmentDate: new Date(dto.assessmentDate),
          }),
          ...(finalizing && {
            status: AnamnesisStatus.COMPLETED,
            completedAt: new Date(),
          }),
        },
        include: INCLUDE,
      });
    });
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.findById(organizationId, id);

    if (existing.status === AnamnesisStatus.COMPLETED) {
      throw new ConflictException(
        'Anamnese finalizada não pode ser excluída. Edite o registro.',
      );
    }

    return this.prisma.anamnesis.delete({ where: { id } });
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
