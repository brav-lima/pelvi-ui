import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import * as Sentry from '@sentry/nestjs'
import { PLAN_FEATURE_KEY } from './decorators/require-feature.decorator'
import { PlanFeature } from './plan-features'
import { SubscriptionService } from './subscription.service'

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<PlanFeature | undefined>(
      PLAN_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (!requiredFeature) return true

    const request = context.switchToHttp().getRequest<{ user?: { organizationId?: string } }>()
    const orgId = request.user?.organizationId

    if (!orgId) return false

    const allowed = await this.subscriptionService.hasFeature(orgId, requiredFeature)

    if (!allowed) {
      Sentry.addBreadcrumb({
        category: 'authz',
        message: 'feature denied',
        level: 'warning',
        data: { requiredFeature, organizationId: orgId },
      })
      throw new ForbiddenException(
        `Seu plano não inclui acesso a esta funcionalidade. Faça upgrade para continuar.`,
      )
    }

    return true
  }
}
