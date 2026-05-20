import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { RedisModule } from '../redis/redis.module';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { REMINDER_QUEUE } from './jobs/reminder.job';
import { ReminderProcessor } from './processors/reminder.processor';

const isTest = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({ connection: redis }),
    }),
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
  ],
  providers: isTest ? [] : [ReminderProcessor],
  exports: [BullModule],
})
export class QueueModule {}
