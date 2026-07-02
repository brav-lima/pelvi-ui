import { Test, TestingModule } from '@nestjs/testing';
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
    subscription: { plan: { features: ['AGENDA', 'PATIENTS'] } },
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

  it('hasFeature responde mesmo com Redis fora do ar', async () => {
    redis.get.mockRejectedValue(new Error('redis down'));
    redis.set.mockRejectedValue(new Error('redis down'));

    await expect(service.hasFeature(orgId, 'AGENDA')).resolves.toBe(true);
    await expect(service.hasFeature(orgId, 'FINANCIAL_BASIC')).resolves.toBe(false);
  });
});
