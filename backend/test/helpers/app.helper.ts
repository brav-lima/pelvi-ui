import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { getQueueToken } from '@nestjs/bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.constants';
import { RedisService } from '../../src/redis/redis.service';
import { REMINDER_QUEUE } from '../../src/queue/jobs/reminder.job';
import { PrismaTestService } from './prisma-test.service';

const redisClientMock = {
  get: async () => null,
  set: async () => 'OK',
  del: async () => 1,
  exists: async () => 0,
  expire: async () => 1,
  keys: async () => [],
};

const redisServiceMock = {
  get: async () => null,
  set: async () => undefined,
  del: async () => undefined,
  exists: async () => false,
  expire: async () => undefined,
  setJson: async () => undefined,
  getJson: async () => null,
  deleteByPattern: async () => undefined,
  client: redisClientMock,
};

const cacheManagerMock = {
  get: async () => undefined,
  set: async () => undefined,
  del: async () => undefined,
};

const reminderQueueMock = {
  add: async () => ({ id: 'mock-job' }),
  getJob: async () => null,
};

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useClass(PrismaTestService)
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }),
    })
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisClientMock)
    .overrideProvider(RedisService)
    .useValue(redisServiceMock)
    .overrideProvider(CACHE_MANAGER)
    .useValue(cacheManagerMock)
    .overrideProvider(getQueueToken(REMINDER_QUEUE))
    .useValue(reminderQueueMock)
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

// Normalise the supertest header to a flat string array regardless of its type
export function normalizeCookies(header: string | string[] | undefined): string[] {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

export function extractCookie(header: string | string[] | undefined, name: string): string {
  const headers = normalizeCookies(header);
  const raw = headers.find((c) => c.startsWith(`${name}=`));
  if (!raw) throw new Error(`Cookie "${name}" not found in Set-Cookie headers`);
  return raw.split(';')[0]; // "name=value" without attributes
}
