import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { RedisModule } from './redis/redis.module';
import { AppCacheModule } from './cache/cache.module';
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
import { VersionModule } from './version/version.module';
import { AccessStatusMiddleware } from './auth/middleware/access-status.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'dev'}`,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ name: 'default', ttl: 60000, limit: 60 }],
        storage: new ThrottlerStorageRedisService(
          new Redis(config.getOrThrow<string>('REDIS_URL')),
        ),
      }),
    }),
    RedisModule,
    AppCacheModule,
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
    VersionModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AccessStatusMiddleware)
      .exclude({ path: 'api/auth/login', method: RequestMethod.POST })
      .forRoutes('*')
  }
}
