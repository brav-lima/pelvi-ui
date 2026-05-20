import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { OrgId } from '../auth/decorators/org-id.decorator'
import { SubscriptionService } from './subscription.service'

@ApiBearerAuth()
@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('status')
  @ApiOperation({ summary: 'Status da assinatura e features disponíveis para a organização' })
  getStatus(@OrgId() organizationId: string) {
    return this.subscriptionService.getSubscription(organizationId)
  }
}
