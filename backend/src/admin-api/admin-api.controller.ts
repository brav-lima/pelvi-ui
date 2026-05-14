import { Controller, Get } from '@nestjs/common'
import { OrgId } from '../auth/decorators/org-id.decorator'
import { AdminApiService } from './admin-api.service'

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
}
