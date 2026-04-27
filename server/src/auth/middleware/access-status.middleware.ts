import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AccessStatusMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return next()

    try {
      const token = authHeader.split(' ')[1]
      const payload = this.jwt.verify(token) as { organizationId?: string }

      if (payload.organizationId) {
        const org = await this.prisma.organization.findUnique({
          where: { id: payload.organizationId },
          select: { accessStatus: true },
        })

        if (org?.accessStatus === 'BLOCKED') {
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
}
