import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import { AppointmentStatus, TreatmentPackageStatus } from '@prisma/client';
import { TreatmentPackageService } from '../treatment-package/treatment-package.service';

const appointmentIncludes = {
  patient: { select: { id: true, name: true } },
  professional: {
    include: {
      person: { select: { id: true, name: true } },
    },
  },
  procedure: { select: { id: true, name: true, durationMinutes: true } },
  treatmentPackage: { select: { id: true, name: true } },
} as const;

@Injectable()
export class AppointmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly treatmentPackageService: TreatmentPackageService,
  ) {}

  async create(organizationId: string, dto: CreateAppointmentDto) {
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: dto.procedureId, organizationId },
    });
    if (!procedure) {
      throw new NotFoundException('Procedimento não encontrado');
    }

    // Validate treatment package if provided
    if (dto.treatmentPackageId) {
      const pkg = await this.prisma.treatmentPackage.findFirst({
        where: { id: dto.treatmentPackageId, organizationId },
        include: { procedures: { select: { procedureId: true } } },
      });

      if (!pkg) {
        throw new NotFoundException('Pacote de tratamento não encontrado');
      }
      if (pkg.status !== TreatmentPackageStatus.ACTIVE) {
        throw new BadRequestException('Pacote de tratamento não está ativo');
      }
      if (pkg.usedSessions >= pkg.totalSessions) {
        throw new BadRequestException(
          'Pacote de tratamento não possui sessões disponíveis',
        );
      }

      const packageProcedureIds = pkg.procedures.map((p) => p.procedureId);
      if (!packageProcedureIds.includes(dto.procedureId)) {
        throw new BadRequestException(
          'Procedimento não faz parte do pacote de tratamento',
        );
      }
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
        treatmentPackageId: dto.treatmentPackageId,
        startAt,
        endAt,
        notes: dto.notes,
      },
      include: appointmentIncludes,
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
      include: appointmentIncludes,
    });
  }

  async findById(organizationId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, organizationId },
      include: appointmentIncludes,
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
      include: appointmentIncludes,
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: AppointmentStatus,
    userId: string,
  ) {
    const existing = await this.findById(organizationId, id);

    // Use transaction if package session tracking is needed
    if (existing.treatmentPackageId) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.appointment.update({
          where: { id },
          data: { status },
          include: appointmentIncludes,
        });

        // Moving TO DONE: increment sessions
        if (
          status === AppointmentStatus.DONE &&
          existing.status !== AppointmentStatus.DONE
        ) {
          await this.treatmentPackageService.incrementUsedSessions(
            organizationId,
            existing.treatmentPackageId!,
            tx,
          );
        }

        // Moving FROM DONE: decrement sessions
        if (
          existing.status === AppointmentStatus.DONE &&
          status !== AppointmentStatus.DONE
        ) {
          await this.treatmentPackageService.decrementUsedSessions(
            organizationId,
            existing.treatmentPackageId!,
            tx,
          );
        }

        return updated;
      });
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status },
      include: appointmentIncludes,
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
