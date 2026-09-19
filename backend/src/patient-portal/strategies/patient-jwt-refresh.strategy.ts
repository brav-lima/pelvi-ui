import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface PatientJwtRefreshPayload {
  sub: string;
  scope: 'patient';
  linkId: string;
  patientId: string;
  organizationId: string;
  jti: string;
  type: 'patient-refresh';
}

@Injectable()
export class PatientJwtRefreshStrategy extends PassportStrategy(Strategy, 'patient-jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  validate(payload: PatientJwtRefreshPayload) {
    return { accountId: payload.sub, linkId: payload.linkId, jti: payload.jti };
  }
}
