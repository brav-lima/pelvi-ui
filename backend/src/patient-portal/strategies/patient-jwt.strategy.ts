import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type PatientJwtScope = 'patient' | 'patient-consent';

export interface PatientJwtPayload {
  sub: string;
  scope: PatientJwtScope;
  linkId?: string;
  patientId?: string;
  organizationId?: string;
  jti: string;
}

import { RedisService } from '../../redis/redis.service';

@Injectable()
export class PatientJwtStrategy extends PassportStrategy(Strategy, 'patient-jwt') {
  constructor(
    configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: PatientJwtPayload): Promise<PatientJwtPayload> {
    // Tokens profissionais não carregam `scope` — nunca são válidos aqui,
    // mesmo assinados com o mesmo segredo.
    if (!payload.scope) {
      throw new UnauthorizedException('Token inválido para este contexto');
    }

    if (payload.jti && (await this.redis.exists(`patient-blacklist:${payload.jti}`))) {
      throw new UnauthorizedException('Token revogado');
    }

    return payload;
  }
}
