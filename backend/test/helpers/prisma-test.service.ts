import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

// Prisma 7 adapter-mode clients only accept `adapter` in the constructor.
// We reuse PrismaNeon (same as production) but read DATABASE_URL directly from
// process.env — ConfigModule has already loaded .env.test before this runs.
@Injectable()
export class PrismaTestService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL must be set in .env.test before running e2e tests');
    super({ adapter: new PrismaNeon({ connectionString: url }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
