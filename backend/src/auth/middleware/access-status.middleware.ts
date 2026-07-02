import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { orgAccessCacheKey } from '../../redis/redis.constants'

const ACCESS_STATUS_TTL_SECONDS = 60

@Injectable()
export class AccessStatusMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Login não depende do contexto da org atual — um cookie stale de org
    // bloqueada não pode impedir um novo login (inclusive em outra clínica)
    if (req.method === 'POST' && this.isLoginPath(req)) return next()

    const authHeader = req.headers.authorization
    const token =
      authHeader?.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : (req.cookies?.['pelvi_access_token'] as string | undefined)

    if (!token) return next()

    try {
      const payload = this.jwt.verify(token) as { organizationId?: string }

      if (payload.organizationId) {
        const status = await this.getAccessStatus(payload.organizationId)

        if (status === 'BLOCKED') {
          throw new ForbiddenException(
            'Acesso suspenso. Entre em contato com o suporte Pelvi.',
          )
        }
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err
      // token inválido/expirado: deixa o JwtAuthGuard tratar
    }

    next()
  }

  private isLoginPath(req: Request): boolean {
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0]
    return /\/auth\/login$/.test(path)
  }

  // Cache do accessStatus (TTL 60s) evita uma query por request; bloqueio de
  // clínica tolera esse atraso. Redis indisponível não derruba a checagem.
  private async getAccessStatus(organizationId: string): Promise<string | null> {
    const key = orgAccessCacheKey(organizationId)

    const cached = await this.redis.get(key).catch(() => null)
    if (cached) return cached

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { accessStatus: true },
    })
    const status = org?.accessStatus ?? null

    if (status) {
      await this.redis.set(key, status, ACCESS_STATUS_TTL_SECONDS).catch(() => undefined)
    }

    return status
  }
}
