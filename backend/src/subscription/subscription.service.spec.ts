import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminApiService } from '../admin-api/admin-api.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prisma: { organization: { findUniqueOrThrow: jest.Mock } };
  let adminApi: { getSubscription: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  const orgId = 'org-1';

  const activeOrg = {
    plan: 'SOLO',
    planStatus: 'ACTIVE',
    trialEndsAt: null,
    founderDiscount: false,
  };

  const adminSubscription = {
    subscription: {
      status: 'ACTIVE',
      trialEndsAt: null,
      plan: { name: 'Origem', features: ['AGENDA', 'PATIENTS'] },
    },
  };

  beforeEach(async () => {
    prisma = { organization: { findUniqueOrThrow: jest.fn().mockResolvedValue(activeOrg) } };
    adminApi = { getSubscription: jest.fn().mockResolvedValue(adminSubscription) };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdminApiService, useValue: adminApi },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  it('retorna snapshot do cache quando disponível', async () => {
    const cached = { plan: 'SOLO', features: ['AGENDA'] };
    redis.get.mockResolvedValue(JSON.stringify(cached));

    const result = await service.getSubscription(orgId);

    expect(result).toEqual(cached);
    expect(prisma.organization.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('monta snapshot do banco em cache miss e grava no cache', async () => {
    const result = await service.getSubscription(orgId);

    expect(result.isActive).toBe(true);
    expect(result.features).toEqual(['AGENDA', 'PATIENTS']);
    expect(redis.set).toHaveBeenCalled();
  });

  it('cai para o banco quando redis.get falha (fail-open do cache)', async () => {
    redis.get.mockRejectedValue(new Error('redis down'));
    redis.set.mockRejectedValue(new Error('redis down'));

    const result = await service.getSubscription(orgId);

    expect(result.isActive).toBe(true);
    expect(result.features).toEqual(['AGENDA', 'PATIENTS']);
  });

  it('não propaga falha do redis.set após montar snapshot', async () => {
    redis.set.mockRejectedValue(new Error('redis down'));

    await expect(service.getSubscription(orgId)).resolves.toMatchObject({
      isActive: true,
    });
  });

  it('usa planStatus e plan do pelvi-admin, ignorando as colunas locais', async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: 'SOLO', planStatus: 'TRIAL', trialEndsAt: null, founderDiscount: false,
    });
    adminApi.getSubscription.mockResolvedValue({
      subscription: { status: 'ACTIVE', trialEndsAt: null, plan: { name: 'Origem', features: ['AGENDA'] } },
    });

    const result = await service.getSubscription(orgId);

    expect(result.plan).toBe('Origem');
    expect(result.planStatus).toBe('ACTIVE');
    expect(result.isActive).toBe(true);
  });

  it('marca org PAST_DUE como inativa e sem features', async () => {
    adminApi.getSubscription.mockResolvedValue({
      subscription: { status: 'PAST_DUE', trialEndsAt: null, plan: { name: 'Origem', features: ['AGENDA'] } },
    });

    const result = await service.getSubscription(orgId);

    expect(result.isActive).toBe(false);
    expect(result.features).toEqual([]);
  });

  it('marca org CANCELED como inativa e sem features', async () => {
    adminApi.getSubscription.mockResolvedValue({
      subscription: { status: 'CANCELED', trialEndsAt: null, plan: { name: 'Origem', features: ['AGENDA'] } },
    });

    const result = await service.getSubscription(orgId);

    expect(result.isActive).toBe(false);
    expect(result.features).toEqual([]);
  });

  it('trial expirado (trialEndsAt no passado) fica inativo', async () => {
    adminApi.getSubscription.mockResolvedValue({
      subscription: {
        status: 'TRIAL',
        trialEndsAt: new Date(Date.now() - 86_400_000).toISOString(),
        plan: { name: 'Origem', features: ['AGENDA'] },
      },
    });

    const result = await service.getSubscription(orgId);

    expect(result.isTrialExpired).toBe(true);
    expect(result.isActive).toBe(false);
  });

  it('trial válido expõe daysLeftInTrial', async () => {
    adminApi.getSubscription.mockResolvedValue({
      subscription: {
        status: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        plan: { name: 'Origem', features: ['AGENDA'] },
      },
    });

    const result = await service.getSubscription(orgId);

    expect(result.isActive).toBe(true);
    expect(result.daysLeftInTrial).toBeGreaterThan(0);
  });

  it('cai para as colunas locais quando o pelvi-admin lança', async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: 'Origem', planStatus: 'ACTIVE', trialEndsAt: null, founderDiscount: true,
    });
    adminApi.getSubscription.mockRejectedValue(new Error('admin down'));

    const result = await service.getSubscription(orgId);

    expect(result.plan).toBe('Origem');
    expect(result.planStatus).toBe('ACTIVE');
    expect(result.isActive).toBe(true);
    expect(result.features).toEqual(expect.arrayContaining(['AGENDA', 'PATIENTS']));
    expect(result.founderDiscount).toBe(true);
  });

  it('cai para as colunas locais quando subscription é null no pelvi-admin', async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: 'Origem', planStatus: 'ACTIVE', trialEndsAt: null, founderDiscount: false,
    });
    adminApi.getSubscription.mockResolvedValue({ subscription: null });

    const result = await service.getSubscription(orgId);

    expect(result.planStatus).toBe('ACTIVE');
    expect(result.features.length).toBeGreaterThan(0); // ALL_PLAN_FEATURES fail-open
  });

  it('plano válido com features: [] retorna [] (não faz fail-open para ALL_PLAN_FEATURES)', async () => {
    adminApi.getSubscription.mockResolvedValue({
      subscription: {
        status: 'ACTIVE',
        trialEndsAt: null,
        plan: { id: 'plan-free', name: 'Gratuito', features: [] },
      },
    });

    const result = await service.getSubscription(orgId);

    expect(result.isActive).toBe(true);
    expect(result.features).toEqual([]);
  });

  it('subscription presente mas sem plano associado → fail-open para ALL_PLAN_FEATURES + warn', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    adminApi.getSubscription.mockResolvedValue({
      subscription: { status: 'ACTIVE', trialEndsAt: null, plan: null },
    });

    const result = await service.getSubscription(orgId);

    expect(result.isActive).toBe(true);
    expect(result.features.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('plano sem id nem name (objeto degenerado) → tratado como não configurado → ALL_PLAN_FEATURES', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    adminApi.getSubscription.mockResolvedValue({
      subscription: { status: 'ACTIVE', trialEndsAt: null, plan: { features: [] } },
    });

    const result = await service.getSubscription(orgId);

    expect(result.features.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('admin TRIAL com trialEndsAt null vence a coluna local expirada (não mistura fontes)', async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: 'SOLO',
      planStatus: 'ACTIVE',
      trialEndsAt: new Date(Date.now() - 30 * 86_400_000), // coluna local defasada
      founderDiscount: false,
    });
    adminApi.getSubscription.mockResolvedValue({
      subscription: { status: 'TRIAL', trialEndsAt: null, plan: { name: 'Origem', features: ['AGENDA'] } },
    });

    const result = await service.getSubscription(orgId);

    expect(result.isTrialExpired).toBe(false);
    expect(result.isActive).toBe(true);
  });

  it('status desconhecido do pelvi-admin (PAUSED) → fallback para colunas locais + logger.error', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: 'Origem', planStatus: 'ACTIVE', trialEndsAt: null, founderDiscount: false,
    });
    adminApi.getSubscription.mockResolvedValue({
      subscription: { status: 'PAUSED', trialEndsAt: null, plan: { name: 'Origem', features: ['AGENDA'] } },
    });

    const result = await service.getSubscription(orgId);

    expect(result.planStatus).toBe('ACTIVE'); // valor local
    expect(result.isActive).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('status ausente do pelvi-admin → fallback para colunas locais', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: 'Origem', planStatus: 'ACTIVE', trialEndsAt: null, founderDiscount: false,
    });
    adminApi.getSubscription.mockResolvedValue({
      subscription: { trialEndsAt: null, plan: { name: 'Origem', features: ['AGENDA'] } },
    });

    const result = await service.getSubscription(orgId);

    expect(result.planStatus).toBe('ACTIVE');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('trialEndsAt inválido do pelvi-admin → fallback para colunas locais', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      plan: 'Origem', planStatus: 'ACTIVE', trialEndsAt: null, founderDiscount: false,
    });
    adminApi.getSubscription.mockResolvedValue({
      subscription: { status: 'TRIAL', trialEndsAt: 'not-a-date', plan: { name: 'Origem', features: ['AGENDA'] } },
    });

    const result = await service.getSubscription(orgId);

    expect(result.planStatus).toBe('ACTIVE'); // valor local, não o TRIAL do admin
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('hasFeature responde mesmo com Redis fora do ar', async () => {
    redis.get.mockRejectedValue(new Error('redis down'));
    redis.set.mockRejectedValue(new Error('redis down'));

    await expect(service.hasFeature(orgId, 'AGENDA')).resolves.toBe(true);
    await expect(service.hasFeature(orgId, 'FINANCIAL_BASIC')).resolves.toBe(false);
  });
});
