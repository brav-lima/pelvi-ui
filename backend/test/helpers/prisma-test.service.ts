import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Standard PrismaClient without the Neon WebSocket adapter — safe for Node.js e2e tests.
// schema.prisma omits the datasource url (it's in prisma.config.ts), so Prisma 7 requires
// the URL to be passed explicitly via datasources rather than relying on env fallback.
@Injectable()
export class PrismaTestService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ datasources: { db: { url: process.env.DATABASE_URL } } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
