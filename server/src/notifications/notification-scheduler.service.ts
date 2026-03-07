import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 */15 * * * *')
  async sendReminders() {
    this.logger.debug('Running appointment reminder check...');

    const orgs = await this.prisma.organization.findMany({
      where: { accessStatus: 'ACTIVE' },
      select: { id: true, settings: true, planFeatures: true },
    });

    for (const org of orgs) {
      const planFeatures = org.planFeatures as Record<string, boolean> | null;
      if (!planFeatures?.whatsapp) continue;

      const settings = org.settings as Record<string, unknown> | null;
      if (!settings?.whatsappNotificationsEnabled) continue;

      const reminderHours = settings?.reminderHours as number | undefined;
      if (!reminderHours) continue;

      await this.processOrgReminders(org.id, reminderHours);
    }
  }

  private async processOrgReminders(
    organizationId: string,
    reminderHours: number,
  ) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + reminderHours * 3_600_000);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        organizationId,
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        notifiedAt: null,
        startAt: { gte: now, lte: windowEnd },
      },
      include: {
        patient: { select: { name: true, phone: true } },
        professional: { include: { person: { select: { name: true } } } },
        procedure: { select: { name: true } },
      },
    });

    for (const appointment of appointments) {
      const phone = appointment.patient?.phone;
      if (!phone) continue;

      const dateStr = this.formatDateTime(appointment.startAt);
      const professionalName =
        appointment.professional?.person?.name ?? 'profissional';
      const procedureName = appointment.procedure?.name ?? 'consulta';

      await this.notifications.sendWhatsApp(
        phone,
        `Olá, ${appointment.patient.name}! Lembrete: você tem um agendamento em ${dateStr} com ${professionalName}. Procedimento: ${procedureName}.`,
      );

      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { notifiedAt: now },
      });

      this.logger.log(
        `Reminder sent for appointment ${appointment.id} (org ${organizationId})`,
      );
    }
  }

  private formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}
