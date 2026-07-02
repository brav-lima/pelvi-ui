import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { AccessStatusMiddleware } from './access-status.middleware';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('AccessStatusMiddleware', () => {
  let middleware: AccessStatusMiddleware;
  let prisma: { organization: { findUnique: jest.Mock } };
  let jwt: { verify: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock };
  let next: jest.Mock;

  const res = {} as Response;

  const makeReq = (overrides: Partial<Request> = {}): Request =>
    ({
      method: 'GET',
      originalUrl: '/api/v1/patients',
      headers: {},
      cookies: { pelvi_access_token: 'token-abc' },
      ...overrides,
    }) as unknown as Request;

  beforeEach(() => {
    prisma = { organization: { findUnique: jest.fn() } };
    jwt = { verify: jest.fn().mockReturnValue({ organizationId: 'org-1' }) };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    next = jest.fn();
    middleware = new AccessStatusMiddleware(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      redis as unknown as RedisService,
    );
  });

  it('bloqueia org com accessStatus BLOCKED (cache miss → consulta banco)', async () => {
    prisma.organization.findUnique.mockResolvedValue({ accessStatus: 'BLOCKED' });

    await expect(middleware.use(makeReq(), res, next)).rejects.toThrow(ForbiddenException);
    expect(next).not.toHaveBeenCalled();
  });

  it('deixa passar org ACTIVE', async () => {
    prisma.organization.findUnique.mockResolvedValue({ accessStatus: 'ACTIVE' });

    await middleware.use(makeReq(), res, next);

    expect(next).toHaveBeenCalled();
  });

  it('pula checagem no POST /api/v1/auth/login mesmo com cookie de org bloqueada', async () => {
    prisma.organization.findUnique.mockResolvedValue({ accessStatus: 'BLOCKED' });

    await middleware.use(
      makeReq({ method: 'POST', originalUrl: '/api/v1/auth/login' } as Partial<Request>),
      res,
      next,
    );

    expect(next).toHaveBeenCalled();
    expect(jwt.verify).not.toHaveBeenCalled();
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it('usa cache do Redis sem consultar o banco (cache hit)', async () => {
    redis.get.mockResolvedValue('BLOCKED');

    await expect(middleware.use(makeReq(), res, next)).rejects.toThrow(ForbiddenException);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it('grava status no cache com TTL de 60s após consulta ao banco', async () => {
    prisma.organization.findUnique.mockResolvedValue({ accessStatus: 'ACTIVE' });

    await middleware.use(makeReq(), res, next);

    expect(redis.set).toHaveBeenCalledWith('cache:org-access:org-1', 'ACTIVE', 60);
  });

  it('consulta o banco quando o Redis falha (fail-open do cache)', async () => {
    redis.get.mockRejectedValue(new Error('redis down'));
    redis.set.mockRejectedValue(new Error('redis down'));
    prisma.organization.findUnique.mockResolvedValue({ accessStatus: 'BLOCKED' });

    await expect(middleware.use(makeReq(), res, next)).rejects.toThrow(ForbiddenException);
  });

  it('segue sem checagem quando não há token', async () => {
    await middleware.use(makeReq({ cookies: {} } as Partial<Request>), res, next);

    expect(next).toHaveBeenCalled();
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('segue quando token é inválido (JwtAuthGuard trata depois)', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await middleware.use(makeReq(), res, next);

    expect(next).toHaveBeenCalled();
  });
});
