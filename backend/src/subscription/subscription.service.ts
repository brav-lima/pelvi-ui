import { Inject, Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import { PrismaService } from '../prisma/prisma.service'
import { AdminApiService } from '../admin-api/admin-api.service'
import { REDIS_CLIENT } from '../redis/redis.constants'
import { PlanFeature } from './plan-features'

const CACHE_TTL_SECONDS = 300 // 5 minutes

export interface SubscriptionSnapshot {
  plan: string
  planStatus: string
  isActive: boolean
  isTrialExpired: boolean
  daysLeftInTrial: number | null
  founderDiscount: boolean
  features: PlanFeature[]
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminApi: AdminApiService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private cacheKey(organizationId: string): string {
    return `subscription:status:${organizationId}`
  }

  async invalidateCache(organizationId: string): Promise<void> {
    await this.redis.del(this.cacheKey(organizationId))
  }

  async getSubscription(organizationId: string): Promise<SubscriptionSnapshot> {
    const cached = await this.redis.get(this.cacheKey(organizationId))
    if (cached) {
      return JSON.parse(cached) as SubscriptionSnapshot
    }

    const snapshot = await this.buildSnapshot(organizationId)

    await this.redis
      .set(this.cacheKey(organizationId), JSON.stringify(snapshot), 'EX', CACHE_TTL_SECONDS)
      .catch((err) => this.logger.warn(`Redis set failed: ${err}`))

    return snapshot
  }

  async hasFeature(organizationId: string, feature: PlanFeature): Promise<boolean> {
    const { features } = await this.getSubscription(organizationId)
    return features.includes(feature)
  }

  private async buildSnapshot(organizationId: string): Promise<SubscriptionSnapshot> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { plan: true, planStatus: true, trialEndsAt: true, founderDiscount: true },
    })

    const isTrialExpired =
      org.planStatus === 'TRIAL' &&
      org.trialEndsAt !== null &&
      org.trialEndsAt < new Date()

    const isActive =
      org.planStatus === 'ACTIVE' ||
      (org.planStatus === 'TRIAL' && !isTrialExpired)

    const daysLeftInTrial =
      org.trialEndsAt != null
        ? Math.max(0, Math.ceil((org.trialEndsAt.getTime() - Date.now()) / 86_400_000))
        : null

    const features = await this.fetchFeaturesFromAdmin(organizationId, isActive)

    return {
      plan: org.plan,
      planStatus: org.planStatus,
      isActive,
      isTrialExpired,
      daysLeftInTrial,
      founderDiscount: org.founderDiscount,
      features,
    }
  }

  // Fetches the feature list for the org's active subscription from pelvi-admin.
  // Returns empty array if admin is unavailable (fail-open during trial to avoid blocking).
  private async fetchFeaturesFromAdmin(
    organizationId: string,
    isActive: boolean,
  ): Promise<PlanFeature[]> {
    if (!isActive) return []

    try {
      const data = await this.adminApi.getSubscription(organizationId)
      const raw: unknown = data?.subscription?.plan?.features ?? []
      // Compatibilidade com planos antigos cujo features é { nfse: true, ... }
      const rawFeatures: unknown[] = Array.isArray(raw)
        ? raw
        : Object.entries(raw as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k)
      return rawFeatures.filter((f): f is PlanFeature => typeof f === 'string')
    } catch (err) {
      this.logger.warn(
        `Could not fetch features from pelvi-admin for org ${organizationId}: ${err}. Returning empty feature list.`,
      )
      return []
    }
  }
}
