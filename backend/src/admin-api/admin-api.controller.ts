import { Body, Controller, Get, Patch, Post } from '@nestjs/common'
import { IsUUID } from 'class-validator'
import { OrgId } from '../auth/decorators/org-id.decorator'
import { AdminApiService } from './admin-api.service'

class ChangePlanDto {
  @IsUUID() planId: string
}

@Controller('subscription')
export class AdminApiController {
  constructor(private readonly service: AdminApiService) {}

  @Get()
  getSubscription(@OrgId() organizationId: string) {
    return this.service.getSubscription(organizationId)
  }

  @Get('plans')
  getPlans() {
    return this.service.getPlans()
  }

  @Patch('plan')
  changePlan(@OrgId() organizationId: string, @Body() dto: ChangePlanDto) {
    return this.service.changePlan(organizationId, dto.planId)
  }

  @Post('cancel')
  cancelSubscription(@OrgId() organizationId: string) {
    return this.service.cancelSubscription(organizationId)
  }
}
