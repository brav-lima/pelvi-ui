import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service';

export interface JwtPayload {
  sub: string;
  organizationId: string;
  role: string;
  jti: string;
}

export const ACCESS_COOKIE_NAME = 'pelvi_access_token';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies?.[ACCESS_COOKIE_NAME] as string | undefined) ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    try {
      if (payload.jti && await this.redis.exists(`blacklist:${payload.jti}`)) {
        throw new UnauthorizedException('Token revogado');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
    }
    return {
      sub: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
      jti: payload.jti,
    };
  }
}
