import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { EmailModule } from '../email/email.module';
import { PatientModule } from '../patient/patient.module';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';
import { PatientJwtStrategy } from './strategies/patient-jwt.strategy';
import { PatientJwtRefreshStrategy } from './strategies/patient-jwt-refresh.strategy';
import { PatientInviteService } from './patient-invite.service';
import { PatientInviteController } from './patient-invite.controller';
import { PatientActivationService } from './patient-activation.service';
import { PatientAuthController } from './patient-auth.controller';
import { PatientAuthService } from './patient-auth.service';
import { PatientConsentService } from './patient-consent.service';
import { PatientConsentController } from './patient-consent.controller';
import { PatientTreatmentPlanService } from './patient-treatment-plan.service';
import { PatientTreatmentPlanController } from './patient-treatment-plan.controller';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_SECRET') }),
    }),
    PatientModule,
    EmailModule,
  ],
  controllers: [
    PatientInviteController,
    PatientAuthController,
    PatientConsentController,
    PatientTreatmentPlanController,
  ],
  providers: [
    PatientAccountService,
    PatientAccountLinkService,
    PatientConsentAuditService,
    PatientJwtStrategy,
    PatientJwtRefreshStrategy,
    PatientInviteService,
    PatientActivationService,
    PatientAuthService,
    PatientConsentService,
    PatientTreatmentPlanService,
  ],
})
export class PatientPortalModule {}
