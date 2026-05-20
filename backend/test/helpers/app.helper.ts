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

function createInMemoryRedis() {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => { store.set(key, value); return 'OK'; },
    del: async (...keys: string[]) => { keys.forEach((k) => store.delete(k)); return keys.length; },
    exists: async (key: string) => (store.has(key) ? 1 : 0),
    expire: async () => 1,
    keys: async (pattern: string) => {
      const prefix = pattern.replace(/\*$/, '');
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

function createInMemoryRedisService() {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => { store.set(key, value); },
    del: async (key: string) => { store.delete(key); },
    exists: async (key: string) => store.has(key),
    expire: async () => undefined,
    setJson: async <T>(key: string, value: T) => { store.set(key, JSON.stringify(value)); },
    getJson: async <T>(key: string): Promise<T | null> => {
      const raw = store.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    },
    deleteByPattern: async (pattern: string) => {
      const prefix = pattern.replace(/\*$/, '');
      [...store.keys()].filter((k) => k.startsWith(prefix)).forEach((k) => store.delete(k));
    },
    client: createInMemoryRedis(),
  };
}

const reminderQueueMock = {
  add: async () => ({ id: 'mock-job' }),
  getJob: async () => null,
};

export async function createTestApp(): Promise<INestApplication> {
  const redisClient = createInMemoryRedis();
  const redisService = createInMemoryRedisService();

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
    .useValue(redisClient)
    .overrideProvider(RedisService)
    .useValue(redisService)
    .overrideProvider(CACHE_MANAGER)
    .useValue({ get: async () => undefined, set: async () => undefined, del: async () => undefined })
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
