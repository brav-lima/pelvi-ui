import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class AppointmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateAppointmentDto) {
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: dto.procedureId, organizationId },
    });
    if (!procedure) {
      throw new NotFoundException('Procedimento não encontrado');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(
      startAt.getTime() + procedure.durationMinutes * 60_000,
    );

    await this.checkConflict(
      organizationId,
      dto.professionalId,
      startAt,
      endAt,
    );

    return this.prisma.appointment.create({
      data: {
        organizationId,
        patientId: dto.patientId,
        professionalId: dto.professionalId,
        procedureId: dto.procedureId,
        startAt,
        endAt,
        notes: dto.notes,
      },
      include: {
        patient: { select: { id: true, name: true } },
        professional: {
          include: {
            person: { select: { id: true, name: true } },
          },
        },
        procedure: { select: { id: true, name: true, durationMinutes: true } },
      },
    });
  }

  async findAll(organizationId: string, query: QueryAppointmentDto) {
    const endDate = new Date(query.endDate);
    endDate.setUTCHours(23, 59, 59, 999);

    const where: Record<string, unknown> = {
      organizationId,
      startAt: {
        gte: new Date(query.startDate),
        lte: endDate,
      },
    };

    if (query.professionalId) {
      where.professionalId = query.professionalId;
    }

    return this.prisma.appointment.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        patient: { select: { id: true, name: true } },
        professional: {
          include: {
            person: { select: { id: true, name: true } },
          },
        },
        procedure: { select: { id: true, name: true, durationMinutes: true } },
      },
    });
  }

  async findById(organizationId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, organizationId },
      include: {
        patient: { select: { id: true, name: true } },
        professional: {
          include: {
            person: { select: { id: true, name: true } },
          },
        },
        procedure: { select: { id: true, name: true, durationMinutes: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    return appointment;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateAppointmentDto,
  ) {
    const existing = await this.findById(organizationId, id);

    let startAt = existing.startAt;
    let endAt = existing.endAt;

    if (dto.startAt || dto.procedureId) {
      const procedureId = dto.procedureId ?? existing.procedureId;
      const procedure = await this.prisma.procedure.findFirst({
        where: { id: procedureId, organizationId },
      });
      if (!procedure) {
        throw new NotFoundException('Procedimento não encontrado');
      }

      startAt = dto.startAt ? new Date(dto.startAt) : existing.startAt;
      endAt = new Date(startAt.getTime() + procedure.durationMinutes * 60_000);

      const professionalId = dto.professionalId ?? existing.professionalId;
      await this.checkConflict(
        organizationId,
        professionalId,
        startAt,
        endAt,
        id,
      );
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        patientId: dto.patientId,
        professionalId: dto.professionalId,
        procedureId: dto.procedureId,
        startAt,
        endAt,
        notes: dto.notes,
      },
      include: {
        patient: { select: { id: true, name: true } },
        professional: {
          include: {
            person: { select: { id: true, name: true } },
          },
        },
        procedure: { select: { id: true, name: true, durationMinutes: true } },
      },
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: AppointmentStatus,
    userId: string,
  ) {
    await this.findById(organizationId, id);

    return this.prisma.appointment.update({
      where: { id },
      data: { status },
      include: {
        patient: { select: { id: true, name: true } },
        professional: {
          include: {
            person: { select: { id: true, name: true } },
          },
        },
        procedure: { select: { id: true, name: true, durationMinutes: true } },
      },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findById(organizationId, id);

    return this.prisma.appointment.delete({ where: { id } });
  }

  private async checkConflict(
    organizationId: string,
    professionalId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
  ) {
    const where: Record<string, unknown> = {
      organizationId,
      professionalId,
      status: { not: AppointmentStatus.CANCELED },
      AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const conflict = await this.prisma.appointment.findFirst({ where });

    if (conflict) {
      throw new ConflictException(
        'Conflito de horário: já existe um agendamento neste período para este profissional',
      );
    }
  }
}
