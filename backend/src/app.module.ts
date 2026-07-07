import { SentryModule } from '@sentry/nestjs/setup';
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { RedisModule } from './redis/redis.module';
import { REDIS_CLIENT } from './redis/redis.constants';
import { QueueModule } from './queue/queue.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { PersonModule } from './person/person.module';
import { PatientModule } from './patient/patient.module';
import { ProfessionalModule } from './professional/professional.module';
import { ProcedureModule } from './procedure/procedure.module';
import { AppointmentModule } from './appointment/appointment.module';
import { AnamnesisModule } from './anamnesis/anamnesis.module';
import { PerinealAssessmentModule } from './perineal-assessment/perineal-assessment.module';
import { EvolutionModule } from './evolution/evolution.module';
import { FinancialModule } from './financial/financial.module';
import { AuditModule } from './audit/audit.module';
import { TreatmentPackageModule } from './treatment-package/treatment-package.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { AdminApiModule } from './admin-api/admin-api.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { VersionModule } from './version/version.module';
import { DocumentModule } from './document/document.module';
import { TaskModule } from './task/task.module';
import { AccessStatusMiddleware } from './auth/middleware/access-status.middleware';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'dev'}`,
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [{ name: 'default', ttl: 60000, limit: 60 }],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
    RedisModule,
    QueueModule,
    PrismaModule,
    AuthModule,
    OrganizationModule,
    PersonModule,
    PatientModule,
    ProfessionalModule,
    ProcedureModule,
    AppointmentModule,
    AnamnesisModule,
    PerinealAssessmentModule,
    EvolutionModule,
    FinancialModule,
    AuditModule,
    TreatmentPackageModule,
    HealthModule,
    InternalModule,
    AdminApiModule,
    SubscriptionModule,
    VersionModule,
    DocumentModule,
    TaskModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AccessStatusMiddleware)
      .exclude({ path: 'api/v1/auth/login', method: RequestMethod.POST })
      .forRoutes('*')
  }
}
