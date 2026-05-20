import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { RedisModule } from '../redis/redis.module'
import { AdminApiModule } from '../admin-api/admin-api.module'
import { SubscriptionController } from './subscription.controller'
import { SubscriptionService } from './subscription.service'
import { PlanGuard } from './plan.guard'

@Module({
  imports: [RedisModule, AdminApiModule],
  controllers: [SubscriptionController],
  providers: [
    SubscriptionService,
    { provide: APP_GUARD, useClass: PlanGuard },
  ],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
