import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { REMINDER_QUEUE } from './jobs/reminder.job';
import { ReminderProcessor } from './processors/reminder.processor';

const isTest = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('REDIS_URL'),
          // Em testes não há Redis: falha rápido, sem retries infinitos
          ...(isTest && { enableOfflineQueue: false, retryStrategy: () => null }),
        },
      }),
    }),
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
  ],
  // Workers não são registrados em testes — BullExplorer não cria conexões de Worker
  providers: isTest ? [] : [ReminderProcessor],
  exports: [BullModule],
})
export class QueueModule {}
