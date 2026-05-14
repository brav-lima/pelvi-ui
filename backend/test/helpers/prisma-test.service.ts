import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaTestService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL must be set in .env.test before running e2e tests');
    const pool = new Pool({ connectionString: url });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    // Give fire-and-forget ops (e.g. pruneStaleRefreshTokens) a moment to settle
    // before closing the pool. Without this, pool.end() races with in-flight
    // Prisma queries dispatched just before disconnect, producing
    // "Cannot use a pool after calling end on the pool" errors across suites.
    await new Promise((resolve) => setTimeout(resolve, 200));
    await this.pool.end().catch(() => {});
  }
}
