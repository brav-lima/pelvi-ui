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
import { PatientInviteService } from './patient-invite.service';
import { PatientInviteController } from './patient-invite.controller';
import { PatientActivationService } from './patient-activation.service';
import { PatientAuthController } from './patient-auth.controller';
import { PatientAuthService } from './patient-auth.service';

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
  controllers: [PatientInviteController, PatientAuthController],
  providers: [
    PatientAccountService,
    PatientAccountLinkService,
    PatientConsentAuditService,
    PatientJwtStrategy,
    PatientInviteService,
    PatientActivationService,
    PatientAuthService,
  ],
})
export class PatientPortalModule {}
