import { Inject, Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import { PrismaService } from '../prisma/prisma.service'
import { AdminApiService } from '../admin-api/admin-api.service'
import { REDIS_CLIENT, subscriptionStatusCacheKey } from '../redis/redis.constants'
import { ALL_PLAN_FEATURES, PlanFeature } from './plan-features'

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
    return subscriptionStatusCacheKey(organizationId)
  }

  async invalidateCache(organizationId: string): Promise<void> {
    await this.redis.del(this.cacheKey(organizationId))
  }

  async getSubscription(organizationId: string): Promise<SubscriptionSnapshot> {
    // Redis fora do ar não pode derrubar o PlanGuard (e com ele todos os
    // endpoints com @RequireFeature) — cache indisponível cai para o banco
    const cached = await this.redis
      .get(this.cacheKey(organizationId))
      .catch((err) => {
        this.logger.warn(`Redis get failed: ${err}`)
        return null
      })
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

    const admin = await this.fetchAdminSubscription(organizationId)

    // Fonte da verdade: pelvi-admin. As colunas locais só valem quando o admin
    // não respondeu ou a org ainda não foi configurada lá.
    const plan = admin?.plan ?? org.plan
    const planStatus = admin?.planStatus ?? org.planStatus
    const trialEndsAt = admin?.trialEndsAt ?? org.trialEndsAt

    const isTrialExpired =
      planStatus === 'TRIAL' && trialEndsAt !== null && trialEndsAt < new Date()

    const isActive =
      planStatus === 'ACTIVE' || (planStatus === 'TRIAL' && !isTrialExpired)

    const daysLeftInTrial =
      trialEndsAt != null
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
        : null

    const features = isActive ? this.resolveFeatures(admin, organizationId) : []

    return {
      plan,
      planStatus,
      isActive,
      isTrialExpired,
      daysLeftInTrial,
      founderDiscount: org.founderDiscount,
      features,
    }
  }

  // Busca a assinatura no pelvi-admin. Retorna null (→ fallback para colunas locais)
  // quando o admin está fora do ar ou a org não está configurada lá.
  private async fetchAdminSubscription(organizationId: string): Promise<{
    plan: string | null
    planStatus: string
    trialEndsAt: Date | null
    rawFeatures: unknown
  } | null> {
    try {
      const data = await this.adminApi.getSubscription(organizationId)
      if (!data?.subscription) {
        this.logger.warn(
          `No subscription in pelvi-admin for org ${organizationId}. Falling back to local columns.`,
        )
        return null
      }
      const sub = data.subscription
      return {
        plan: sub.plan?.name ?? null,
        planStatus: String(sub.status),
        trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt) : null,
        rawFeatures: sub.plan?.features ?? [],
      }
    } catch (err) {
      this.logger.warn(
        `Could not fetch subscription from pelvi-admin for org ${organizationId}: ${err}. Falling back to local columns.`,
      )
      return null
    }
  }

  // Normaliza a lista de features. Fail-open (ALL_PLAN_FEATURES) quando o admin
  // não respondeu ou o plano ainda não tem features configuradas.
  private resolveFeatures(
    admin: { rawFeatures: unknown } | null,
    organizationId: string,
  ): PlanFeature[] {
    if (!admin) {
      this.logger.warn(
        `Falling back to ALL_PLAN_FEATURES for org ${organizationId} (admin unavailable).`,
      )
      return ALL_PLAN_FEATURES
    }
    const raw = admin.rawFeatures
    const rawFeatures: unknown[] = Array.isArray(raw)
      ? raw
      : Object.entries(raw as Record<string, boolean>)
          .filter(([, v]) => v)
          .map(([k]) => k)
    const features = rawFeatures.filter((f): f is PlanFeature => typeof f === 'string')
    if (features.length === 0) {
      this.logger.warn(
        `Empty features from pelvi-admin for org ${organizationId}. Falling back to ALL_PLAN_FEATURES.`,
      )
      return ALL_PLAN_FEATURES
    }
    return features
  }
}
