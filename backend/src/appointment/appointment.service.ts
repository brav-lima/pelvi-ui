import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, AppointmentStatus, TreatmentPackageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import { TreatmentPackageService } from '../treatment-package/treatment-package.service';
import { REMINDER_QUEUE, ReminderJobData } from '../queue/jobs/reminder.job';

const AGENDA_CACHE_TTL = 30;

const agendaKey = (
  orgId: string,
  startDate: string,
  endDate: string,
  professionalId?: string,
) => `cache:agenda:${orgId}:${startDate}:${endDate}:${professionalId ?? 'all'}`;

const appointmentIncludes = {
  patient: { select: { id: true, name: true } },
  professional: {
    include: {
      person: { select: { id: true, name: true } },
    },
  },
  procedure: { select: { id: true, name: true, durationMinutes: true, price: true } },
  treatmentPackage: { select: { id: true, name: true } },
} as const;

@Injectable()
export class AppointmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly treatmentPackageService: TreatmentPackageService,
    private readonly redis: RedisService,
    @InjectQueue(REMINDER_QUEUE) private readonly reminderQueue: Queue<ReminderJobData>,
  ) {}

  async create(organizationId: string, dto: CreateAppointmentDto) {
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: dto.procedureId, organizationId },
    });
    if (!procedure) {
      throw new NotFoundException('Procedimento não encontrado');
    }

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

    return this.prisma.$transaction(async (tx) => {
      await this.checkConflict(
        organizationId,
        dto.professionalId,
        startAt,
        endAt,
        undefined,
        tx,
      );

      const created = await tx.appointment.create({
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

      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).then(async (created) => {
      await this.invalidateAgendaCache(organizationId);
      await this.scheduleReminder(created.id, dto.patientId, organizationId, startAt);
      return created;
    });
  }

  async findAll(organizationId: string, query: QueryAppointmentDto) {
    const cacheKey = agendaKey(organizationId, query.startDate, query.endDate, query.professionalId);
    const cached = await this.redis.getJson(cacheKey);
    if (cached) return cached;

    const endDate = new Date(query.endDate);
    endDate.setUTCHours(23, 59, 59, 999);

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
      startAt: {
        gte: new Date(query.startDate),
        lte: endDate,
      },
    };

    if (query.professionalId) {
      where.professionalId = query.professionalId;
    }

    const result = await this.prisma.appointment.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: appointmentIncludes,
    });

    await this.redis.setJson(cacheKey, result, AGENDA_CACHE_TTL);
    return result;
  }

  async findById(organizationId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, organizationId, deletedAt: null },
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

    if (!dto.startAt && !dto.procedureId) {
      const updated = await this.prisma.appointment.update({
        where: { id },
        data: {
          patientId: dto.patientId,
          professionalId: dto.professionalId,
          notes: dto.notes,
        },
        include: appointmentIncludes,
      });
      await this.invalidateAgendaCache(organizationId);
      return updated;
    }

    const procedureId = dto.procedureId ?? existing.procedureId;
    const procedure = await this.prisma.procedure.findFirst({
      where: { id: procedureId, organizationId },
    });
    if (!procedure) {
      throw new NotFoundException('Procedimento não encontrado');
    }

    const startAt = dto.startAt ? new Date(dto.startAt) : existing.startAt;
    const endAt = new Date(startAt.getTime() + procedure.durationMinutes * 60_000);
    const professionalId = dto.professionalId ?? existing.professionalId;

    return this.prisma.$transaction(async (tx) => {
      await this.checkConflict(organizationId, professionalId, startAt, endAt, id, tx);
      return tx.appointment.update({
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).then(async (updated) => {
      await this.invalidateAgendaCache(organizationId);
      if (dto.startAt) {
        await this.rescheduleReminder(id, existing.patientId, organizationId, startAt);
      }
      return updated;
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: AppointmentStatus,
    userId: string,
  ) {
    const existing = await this.findById(organizationId, id);

    if (existing.treatmentPackageId) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.appointment.update({
          where: { id },
          data: { status },
          include: appointmentIncludes,
        });

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

        return result;
      });

      await this.invalidateAgendaCache(organizationId);
      if (status === AppointmentStatus.CANCELED) {
        await this.cancelReminder(id);
      }
      return updated;
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status },
      include: appointmentIncludes,
    });

    await this.invalidateAgendaCache(organizationId);
    if (status === AppointmentStatus.CANCELED) {
      await this.cancelReminder(id);
    }
    return updated;
  }

  async remove(organizationId: string, id: string) {
    await this.findById(organizationId, id);

    const removed = await this.prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.invalidateAgendaCache(organizationId);
    await this.cancelReminder(id);
    return removed;
  }

  private async invalidateAgendaCache(organizationId: string): Promise<void> {
    await this.redis.deleteByPattern(`cache:agenda:${organizationId}:*`);
  }

  private async scheduleReminder(
    appointmentId: string,
    patientId: string,
    organizationId: string,
    startAt: Date,
  ): Promise<void> {
    const delay = startAt.getTime() - Date.now() - 60 * 60 * 1000; // 1h antes
    if (delay <= 0) return;

    await this.reminderQueue.add(
      'reminder',
      { appointmentId, patientId, organizationId, startAt: startAt.toISOString() },
      { jobId: `reminder-${appointmentId}`, delay },
    );
  }

  private async rescheduleReminder(
    appointmentId: string,
    patientId: string,
    organizationId: string,
    startAt: Date,
  ): Promise<void> {
    await this.cancelReminder(appointmentId);
    await this.scheduleReminder(appointmentId, patientId, organizationId, startAt);
  }

  private async cancelReminder(appointmentId: string): Promise<void> {
    const job = await this.reminderQueue.getJob(`reminder-${appointmentId}`);
    await job?.remove();
  }

  private async checkConflict(
    organizationId: string,
    professionalId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;

    const where: Record<string, unknown> = {
      organizationId,
      professionalId,
      deletedAt: null,
      status: { not: AppointmentStatus.CANCELED },
      AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const conflict = await client.appointment.findFirst({ where });

    if (conflict) {
      throw new ConflictException(
        'Conflito de horário: já existe um agendamento neste período para este profissional',
      );
    }
  }
}
