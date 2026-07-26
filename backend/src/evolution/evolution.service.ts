import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEvolutionDto } from './dto/create-evolution.dto';
import { UpdateEvolutionDto } from './dto/update-evolution.dto';

@Injectable()
export class EvolutionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    personId: string,
    dto: CreateEvolutionDto,
  ) {
    const orgUser = await this.resolveOrgUser(organizationId, personId);

    if (dto.evolutionDate) {
      this.assertNotFutureDate(dto.evolutionDate);
    }

    return this.prisma.evolution.create({
      data: {
        organizationId,
        patientId: dto.patientId,
        professionalId: orgUser.id,
        appointmentId: dto.appointmentId,
        description: dto.description,
        evolutionDate: dto.evolutionDate ? new Date(dto.evolutionDate) : new Date(),
        ...(dto.legalBasis && { legalBasis: dto.legalBasis }),
        ...(dto.consentId && { consentId: dto.consentId }),
      },
      include: {
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
        appointment: {
          select: { id: true, startAt: true, status: true },
        },
      },
    });
  }

  async findByPatient(organizationId: string, patientId: string) {
    return this.prisma.evolution.findMany({
      where: { organizationId, patientId },
      orderBy: [{ evolutionDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
        appointment: {
          select: { id: true, startAt: true, status: true },
        },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    const evolution = await this.prisma.evolution.findFirst({
      where: { id, organizationId },
      include: {
        patient: { select: { id: true, name: true } },
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
        appointment: {
          select: { id: true, startAt: true, status: true },
        },
      },
    });

    if (!evolution) {
      throw new NotFoundException('Evolução não encontrada');
    }

    return evolution;
  }

  async update(organizationId: string, id: string, dto: UpdateEvolutionDto) {
    const existing = await this.prisma.evolution.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException('Evolução não encontrada');
    }

    if (dto.evolutionDate) {
      this.assertNotFutureDate(dto.evolutionDate);
    }

    return this.prisma.evolution.update({
      where: { id },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.evolutionDate && { evolutionDate: new Date(dto.evolutionDate) }),
      },
      include: {
        professional: {
          include: { person: { select: { id: true, name: true } } },
        },
        appointment: {
          select: { id: true, startAt: true, status: true },
        },
      },
    });
  }

  private assertNotFutureDate(date: string) {
    if (new Date(date).getTime() > Date.now()) {
      throw new BadRequestException(
        'Data da evolução não pode ser no futuro',
      );
    }
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
