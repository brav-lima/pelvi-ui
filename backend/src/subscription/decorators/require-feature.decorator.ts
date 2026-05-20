import { SetMetadata } from '@nestjs/common'
import { PlanFeature } from '../plan-features'

export const PLAN_FEATURE_KEY = 'planFeature'

export const RequireFeature = (feature: PlanFeature) =>
  SetMetadata(PLAN_FEATURE_KEY, feature)
