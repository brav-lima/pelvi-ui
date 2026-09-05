import { Inject, Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import { PrismaService } from '../prisma/prisma.service'
import { AdminApiService } from '../admin-api/admin-api.service'
import { REDIS_CLIENT, subscriptionStatusCacheKey } from '../redis/redis.constants'
import { ALL_PLAN_FEATURES, PlanFeature } from './plan-features'

const CACHE_TTL_SECONDS = 300 // 5 minutes

// Status de assinatura que o pelvi-ui sabe interpretar. Qualquer valor fora
// desta lista (casing novo, PAUSED, valores futuros) → fallback para colunas locais.
const KNOWN_STATUSES = new Set(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'])

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

    // Fonte da verdade: pelvi-admin. Escolhe o objeto-fonte UMA vez e lê todos os
    // campos dele — nunca mistura admin + coluna local no mesmo snapshot. Um
    // trialEndsAt local defasado não pode sobrepor o `null` legítimo do admin
    // (senão um trial admin válido viraria "expirado" → lockout).
    const source = admin ?? {
      plan: org.plan,
      planStatus: org.planStatus,
      trialEndsAt: org.trialEndsAt,
    }
    const plan = source.plan ?? org.plan // nome de plano do admin pode faltar → tier local
    const planStatus = source.planStatus
    const trialEndsAt = source.trialEndsAt

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
    // Features cruas do plano, ou `null` quando a assinatura não tem plano real
    // associado (ainda não configurado no pelvi-admin). `null` → fail-open;
    // `[]` é um plano legítimo que simplesmente não libera nada.
    rawFeatures: unknown[] | Record<string, boolean> | null
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

      // Contrato do pelvi-admin pode driftar (status desconhecido, data inválida).
      // Em vez de propagar lixo e travar o PlanGuard por 5 min, cai para o local.
      const status = String(sub.status)
      if (!KNOWN_STATUSES.has(status)) {
        this.logger.error(
          `Unrecognized subscription status "${status}" from pelvi-admin for org ${organizationId}. Falling back to local columns.`,
        )
        return null
      }

      const trialEndsAt = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null
      if (trialEndsAt && Number.isNaN(trialEndsAt.getTime())) {
        this.logger.error(
          `Invalid trialEndsAt "${sub.trialEndsAt}" from pelvi-admin for org ${organizationId}. Falling back to local columns.`,
        )
        return null
      }

      // Plano "real" = objeto com id ou name. Sem isso, a assinatura existe mas
      // não tem plano configurado no admin → rawFeatures `null` (fail-open).
      const hasRealPlan = Boolean(sub.plan && (sub.plan.id || sub.plan.name))

      return {
        plan: sub.plan?.name ?? null,
        planStatus: status,
        trialEndsAt,
        rawFeatures: hasRealPlan ? (sub.plan.features ?? []) : null,
      }
    } catch (err) {
      this.logger.warn(
        `Could not fetch subscription from pelvi-admin for org ${organizationId}: ${err}. Falling back to local columns.`,
      )
      return null
    }
  }

  // Normaliza a lista de features. Fail-open (ALL_PLAN_FEATURES) só quando o
  // admin não respondeu (`!admin`) ou a assinatura não tem plano configurado
  // (`rawFeatures === null`). Um plano real com `features: []` é intencional —
  // retorna `[]` e deixa o PlanGuard bloquear as features pagas.
  private resolveFeatures(
    admin: { rawFeatures: unknown[] | Record<string, boolean> | null } | null,
    organizationId: string,
  ): PlanFeature[] {
    if (!admin) {
      this.logger.warn(
        `Falling back to ALL_PLAN_FEATURES for org ${organizationId} (admin unavailable).`,
      )
      return ALL_PLAN_FEATURES
    }
    const raw = admin.rawFeatures
    if (raw === null) {
      this.logger.warn(
        `No plan configured in pelvi-admin for org ${organizationId}. Falling back to ALL_PLAN_FEATURES.`,
      )
      return ALL_PLAN_FEATURES
    }
    const rawFeatures: unknown[] = Array.isArray(raw)
      ? raw
      : Object.entries(raw)
          .filter(([, v]) => v)
          .map(([k]) => k)
    return rawFeatures.filter((f): f is PlanFeature => typeof f === 'string')
  }
}
