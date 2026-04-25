import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

export interface JwtRefreshPayload {
  sub: string;
  organizationId: string;
  role: string;
  jti: string;
  type: 'refresh';
}

export const REFRESH_COOKIE_NAME = 'careflow_refresh_token';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  validate(payload: JwtRefreshPayload) {
    return {
      personId: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
      jti: payload.jti,
    };
  }
}
