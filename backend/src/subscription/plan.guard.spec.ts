import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import * as Sentry from '@sentry/nestjs'
import { PlanGuard } from './plan.guard'
import { SubscriptionService } from './subscription.service'

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  logger: { warn: jest.fn() },
}))

describe('PlanGuard', () => {
  let guard: PlanGuard
  let reflector: { getAllAndOverride: jest.Mock }
  let subscriptionService: { hasFeature: jest.Mock }

  const makeContext = (organizationId?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user: { organizationId } }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext

  beforeEach(() => {
    jest.clearAllMocks()
    reflector = { getAllAndOverride: jest.fn() }
    subscriptionService = { hasFeature: jest.fn() }
    guard = new PlanGuard(
      reflector as unknown as Reflector,
      subscriptionService as unknown as SubscriptionService,
    )
  })

  it('permite quando não há feature exigida', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined)

    await expect(guard.canActivate(makeContext('org-1'))).resolves.toBe(true)
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled()
  })

  it('permite quando plano inclui a feature', async () => {
    reflector.getAllAndOverride.mockReturnValue('FINANCIAL_BASIC')
    subscriptionService.hasFeature.mockResolvedValue(true)

    await expect(guard.canActivate(makeContext('org-1'))).resolves.toBe(true)
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled()
  })

  it('emite breadcrumb e lança ForbiddenException quando plano não inclui a feature', async () => {
    reflector.getAllAndOverride.mockReturnValue('FINANCIAL_BASIC')
    subscriptionService.hasFeature.mockResolvedValue(false)

    await expect(guard.canActivate(makeContext('org-1'))).rejects.toThrow(ForbiddenException)
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'authz',
      message: 'feature denied',
      level: 'warning',
      data: { requiredFeature: 'FINANCIAL_BASIC', organizationId: 'org-1' },
    })
    expect(Sentry.logger.warn).toHaveBeenCalledWith('feature denied', {
      requiredFeature: 'FINANCIAL_BASIC',
      organizationId: 'org-1',
    })
  })
})
