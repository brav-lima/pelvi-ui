jest.mock('expo-server-sdk', () => {
  return {
    Expo: jest.fn().mockImplementation(() => ({
      chunkPushNotifications: jest.fn((messages: unknown[]) => [messages]),
      sendPushNotificationsAsync: jest.fn().mockResolvedValue([{ status: 'ok' }]),
    })),
    isExpoPushToken: jest.fn((token: string) => token.startsWith('ExponentPushToken')),
  };
});

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

import * as Sentry from '@sentry/nestjs';
import { Job } from 'bullmq';
import { ReminderProcessor } from './reminder.processor';
import { ReminderJobData } from '../jobs/reminder.job';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpoPushService } from '../../device/expo-push.service';

describe('ReminderProcessor', () => {
  let processor: ReminderProcessor;
  let prisma: { organizationUser: any; deviceToken: any; patient: any };
  let pushService: { isValidToken: jest.Mock; send: jest.Mock };

  const baseData: ReminderJobData = {
    appointmentId: 'apt-1',
    patientId: 'patient-1',
    professionalId: 'prof-1',
    organizationId: 'org-1',
    startAt: '2026-08-01T13:00:00.000Z',
  };

  const makeJob = (data: ReminderJobData): Job<ReminderJobData> => ({ data }) as Job<ReminderJobData>;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      organizationUser: { findUnique: jest.fn().mockResolvedValue({ personId: 'person-1' }) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
      patient: { findUnique: jest.fn().mockResolvedValue({ name: 'Maria' }) },
    };
    pushService = {
      isValidToken: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue(undefined),
    };

    processor = new ReminderProcessor(prisma as unknown as PrismaService, pushService as unknown as ExpoPushService);
  });

  it('processa o lembrete sem erro quando não há device token cadastrado', async () => {
    await processor.process(makeJob(baseData));

    expect(pushService.send).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('envia push pros device tokens do profissional quando existem', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([
      { expoPushToken: 'ExponentPushToken[abc]' },
      { expoPushToken: 'ExponentPushToken[def]' },
    ]);

    await processor.process(makeJob(baseData));

    expect(prisma.organizationUser.findUnique).toHaveBeenCalledWith({
      where: { id: 'prof-1' },
      select: { personId: true },
    });
    expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({ where: { personId: 'person-1' } });
    expect(pushService.send).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[abc]', body: expect.stringContaining('Maria') }),
      expect.objectContaining({ to: 'ExponentPushToken[def]', body: expect.stringContaining('Maria') }),
    ]);
  });

  it('não envia push e não relança quando o envio falha (best-effort)', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([{ expoPushToken: 'ExponentPushToken[abc]' }]);
    pushService.send.mockRejectedValue(new Error('expo down'));

    await expect(processor.process(makeJob(baseData))).resolves.toBeUndefined();

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it('captura exceção no Sentry e relança quando o processamento falha por outro motivo', async () => {
    const job = makeJob(baseData);

    const originalLog = (processor as any).logger.log;
    (processor as any).logger.log = jest.fn(() => {
      throw new Error('boom');
    });

    await expect(processor.process(job)).rejects.toThrow('boom');

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'queue',
      message: 'reminder processing failed',
      level: 'error',
      data: { appointmentId: 'apt-1' },
    });

    (processor as any).logger.log = originalLog;
  });
});
