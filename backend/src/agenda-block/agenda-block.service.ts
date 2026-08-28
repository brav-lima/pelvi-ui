import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgendaBlockDto } from './dto/create-agenda-block.dto';
import { UpdateAgendaBlockDto } from './dto/update-agenda-block.dto';
import { QueryAgendaBlockDto } from './dto/query-agenda-block.dto';

@Injectable()
export class AgendaBlockService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    personId: string,
    role: string,
    dto: CreateAgendaBlockDto,
  ) {
    const ownOrgUser = await this.resolveOrgUser(organizationId, personId);
    await this.validateProfessional(organizationId, dto.professionalId);
    this.assertOwnAgendaIfProfessional(role, ownOrgUser.id, dto.professionalId);

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (endAt <= startAt) {
      throw new BadRequestException('Data/hora de fim deve ser depois do início');
    }

    await this.checkConflict(organizationId, dto.professionalId, startAt, endAt);

    return this.prisma.agendaBlock.create({
      data: {
        organizationId,
        professionalId: dto.professionalId,
        title: dto.title,
        startAt,
        endAt,
        notes: dto.notes,
      },
    });
  }

  async findAll(organizationId: string, query: QueryAgendaBlockDto) {
    const endDate = new Date(query.endDate);
    endDate.setUTCHours(23, 59, 59, 999);

    return this.prisma.agendaBlock.findMany({
      where: {
        organizationId,
        startAt: { lt: endDate },
        endAt: { gt: new Date(query.startDate) },
        ...(query.professionalId && { professionalId: query.professionalId }),
      },
      include: {
        professional: { include: { person: { select: { id: true, name: true } } } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async update(
    organizationId: string,
    personId: string,
    role: string,
    id: string,
    dto: UpdateAgendaBlockDto,
  ) {
    const ownOrgUser = await this.resolveOrgUser(organizationId, personId);
    const existing = await this.findOwnedBlock(organizationId, id);

    if (dto.professionalId) {
      await this.validateProfessional(organizationId, dto.professionalId);
    }

    this.assertOwnAgendaIfProfessional(role, ownOrgUser.id, existing.professionalId);

    const professionalId = dto.professionalId ?? existing.professionalId;
    if (role === 'PROFESSIONAL' && dto.professionalId) {
      this.assertOwnAgendaIfProfessional(role, ownOrgUser.id, dto.professionalId);
    }

    const startAt = dto.startAt ? new Date(dto.startAt) : existing.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : existing.endAt;

    if (endAt <= startAt) {
      throw new BadRequestException('Data/hora de fim deve ser depois do início');
    }

    if (dto.startAt || dto.endAt || dto.professionalId) {
      await this.checkConflict(organizationId, professionalId, startAt, endAt, id);
    }

    return this.prisma.agendaBlock.update({
      where: { id },
      data: {
        ...(dto.professionalId && { professionalId: dto.professionalId }),
        ...(dto.title && { title: dto.title }),
        ...(dto.startAt && { startAt }),
        ...(dto.endAt && { endAt }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(organizationId: string, personId: string, role: string, id: string) {
    const ownOrgUser = await this.resolveOrgUser(organizationId, personId);
    const existing = await this.findOwnedBlock(organizationId, id);
    this.assertOwnAgendaIfProfessional(role, ownOrgUser.id, existing.professionalId);

    await this.prisma.agendaBlock.delete({ where: { id: existing.id } });
  }

  private async findOwnedBlock(organizationId: string, id: string) {
    const block = await this.prisma.agendaBlock.findFirst({
      where: { id, organizationId },
    });
    if (!block) {
      throw new NotFoundException('Bloqueio não encontrado');
    }
    return block;
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

  private async validateProfessional(organizationId: string, professionalId: string) {
    const professional = await this.prisma.organizationUser.findFirst({
      where: { id: professionalId, organizationId, active: true },
      select: { id: true },
    });
    if (!professional) throw new NotFoundException('Profissional não encontrado');
  }

  private assertOwnAgendaIfProfessional(
    role: string,
    ownOrgUserId: string,
    targetProfessionalId: string,
  ) {
    if (role === 'PROFESSIONAL' && targetProfessionalId !== ownOrgUserId) {
      throw new ForbiddenException('Profissional só pode bloquear a própria agenda');
    }
  }

  private async checkConflict(
    organizationId: string,
    professionalId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
  ) {
    const overlap = { AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }] };

    const blockConflict = await this.prisma.agendaBlock.findFirst({
      where: {
        organizationId,
        professionalId,
        ...overlap,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    if (blockConflict) {
      throw new ConflictException(
        'Conflito de horário: já existe um bloqueio neste período para este profissional',
      );
    }

    const appointmentConflict = await this.prisma.appointment.findFirst({
      where: {
        organizationId,
        professionalId,
        deletedAt: null,
        status: { not: 'CANCELED' },
        ...overlap,
      },
    });
    if (appointmentConflict) {
      throw new ConflictException(
        'Conflito de horário: já existe um agendamento neste período para este profissional',
      );
    }
  }
}
