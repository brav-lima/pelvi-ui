import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnamnesisDto } from './dto/create-anamnesis.dto';
import { UpdateAnamnesisDto } from './dto/update-anamnesis.dto';

@Injectable()
export class AnamnesisService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    personId: string,
    dto: CreateAnamnesisDto,
  ) {
    const orgUser = await this.resolveOrgUser(organizationId, personId);

    return this.prisma.anamnesis.create({
      data: {
        organizationId,
        patientId: dto.patientId,
        professionalId: orgUser.id,
        data: dto.data as Prisma.InputJsonValue,
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
    return this.prisma.anamnesis.findMany({
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
    const anamnesis = await this.prisma.anamnesis.findFirst({
      where: { id, organizationId },
      include: {
        patient: { select: { id: true, name: true } },
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
      },
    });

    if (!anamnesis) {
      throw new NotFoundException('Anamnese não encontrada');
    }

    return anamnesis;
  }

  async update(organizationId: string, id: string, dto: UpdateAnamnesisDto) {
    const existing = await this.findById(organizationId, id);

    const mergedData =
      existing.data && typeof existing.data === 'object' && !Array.isArray(existing.data)
        ? { ...(existing.data as Record<string, unknown>), ...dto.data }
        : dto.data;

    return this.prisma.anamnesis.update({
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
