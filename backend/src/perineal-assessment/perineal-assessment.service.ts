import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePerinealAssessmentDto } from './dto/create-perineal-assessment.dto';
import { UpdatePerinealAssessmentDto } from './dto/update-perineal-assessment.dto';

@Injectable()
export class PerinealAssessmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    personId: string,
    dto: CreatePerinealAssessmentDto,
  ) {
    const orgUser = await this.resolveOrgUser(organizationId, personId);

    return this.prisma.perinealAssessment.create({
      data: {
        organizationId,
        patientId: dto.patientId,
        professionalId: orgUser.id,
        data: dto.data as Prisma.InputJsonValue,
        ...(dto.legalBasis && { legalBasis: dto.legalBasis }),
        ...(dto.consentId && { consentId: dto.consentId }),
        ...(dto.legalBasisNotes && { legalBasisNotes: dto.legalBasisNotes }),
      },
      include: {
        patient: { select: { id: true, name: true } },
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async findByPatient(organizationId: string, patientId: string) {
    return this.prisma.perinealAssessment.findMany({
      where: { organizationId, patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    const assessment = await this.prisma.perinealAssessment.findFirst({
      where: { id, organizationId },
      include: {
        patient: { select: { id: true, name: true } },
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
      },
    });

    if (!assessment) {
      throw new NotFoundException('Ficha perineal não encontrada');
    }

    return assessment;
  }

  async remove(organizationId: string, id: string) {
    await this.findById(organizationId, id);
    return this.prisma.perinealAssessment.delete({ where: { id } });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdatePerinealAssessmentDto,
  ) {
    const existing = await this.findById(organizationId, id);

    const mergedData =
      existing.data && typeof existing.data === 'object' && !Array.isArray(existing.data)
        ? { ...(existing.data as Record<string, unknown>), ...dto.data }
        : dto.data;

    return this.prisma.perinealAssessment.update({
      where: { id },
      data: { data: mergedData as Prisma.InputJsonValue },
      include: {
        patient: { select: { id: true, name: true } },
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
      },
    });
  }

  private async resolveOrgUser(organizationId: string, personId: string) {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_personId: { organizationId, personId },
      },
    });

    if (!orgUser || !orgUser.active) {
      throw new ForbiddenException('Vínculo com a clínica não encontrado');
    }

    return orgUser;
  }
}
