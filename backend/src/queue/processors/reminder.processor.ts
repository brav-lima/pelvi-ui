import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Job } from 'bullmq';
import { REMINDER_QUEUE, ReminderJobData } from '../jobs/reminder.job';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpoPushService } from '../../device/expo-push.service';

@Processor(REMINDER_QUEUE)
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: ExpoPushService,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<void> {
    const { appointmentId, patientId, organizationId, professionalId, startAt } = job.data;

    if (!appointmentId || !patientId || !organizationId || !professionalId || !startAt) {
      this.logger.warn(
        `Reminder job com payload incompleto (provavelmente enfileirado antes de um formato de dado mais novo), ignorando: ${JSON.stringify(job.data)}`,
      );
      return;
    }

    try {
      this.logger.log(
        `Reminder: appointment=${appointmentId} patient=${patientId} org=${organizationId} startAt=${startAt}`,
      );

      await this.sendPushReminder(appointmentId, professionalId, patientId, startAt);

      // TODO: adicionar outros canais quando disponíveis:
      // - WhatsApp
      // - Email
    } catch (err) {
      Sentry.addBreadcrumb({
        category: 'queue',
        message: 'reminder processing failed',
        level: 'error',
        data: { appointmentId },
      });
      Sentry.captureException(err);
      throw err;
    }
  }

  private async sendPushReminder(
    appointmentId: string,
    professionalId: string,
    patientId: string,
    startAt: string,
  ): Promise<void> {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: { id: professionalId },
      select: { personId: true },
    });
    if (!orgUser) return;

    const devices = await this.prisma.deviceToken.findMany({
      where: { personId: orgUser.personId },
    });
    const validDevices = devices.filter((d) => this.pushService.isValidToken(d.expoPushToken));
    if (validDevices.length === 0) return;

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { name: true },
    });

    const time = new Date(startAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
    const body = patient ? `${time} com ${patient.name}` : `Consulta às ${time}`;

    try {
      await this.pushService.send(
        validDevices.map((d) => ({
          to: d.expoPushToken,
          sound: 'default' as const,
          title: 'Consulta em 1 hora',
          body,
        })),
      );
    } catch (err) {
      Sentry.addBreadcrumb({
        category: 'queue',
        message: 'push reminder send failed',
        level: 'warning',
        data: { appointmentId },
      });
      Sentry.captureException(err);
      // best-effort: não relança — falha de push não deve reprocessar o job
    }
  }
}
