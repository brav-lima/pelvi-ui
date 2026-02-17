import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { PersonModule } from './person/person.module';
import { PatientModule } from './patient/patient.module';
import { ProfessionalModule } from './professional/professional.module';
import { ProcedureModule } from './procedure/procedure.module';
import { AppointmentModule } from './appointment/appointment.module';
import { AnamnesisModule } from './anamnesis/anamnesis.module';
import { EvolutionModule } from './evolution/evolution.module';
import { FinancialModule } from './financial/financial.module';
import { AuditModule } from './audit/audit.module';
import { TreatmentPackageModule } from './treatment-package/treatment-package.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'dev'}`,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
    ]),
    PrismaModule,
    AuthModule,
    OrganizationModule,
    PersonModule,
    PatientModule,
    ProfessionalModule,
    ProcedureModule,
    AppointmentModule,
    AnamnesisModule,
    EvolutionModule,
    FinancialModule,
    AuditModule,
    TreatmentPackageModule,
  ],
})
export class AppModule {}
