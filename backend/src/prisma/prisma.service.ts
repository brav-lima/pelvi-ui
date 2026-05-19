import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { types } from 'pg';

// PrismaPg returns DateTime fields as Date objects that serialize as {} in JSON.
// Configuring pg type parsers to return ISO strings fixes serialization for all DateTime fields.
types.setTypeParser(types.builtins.TIMESTAMP, (val: string) => new Date(val).toISOString());
types.setTypeParser(types.builtins.TIMESTAMPTZ, (val: string) => new Date(val).toISOString());

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
