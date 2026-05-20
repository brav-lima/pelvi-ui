import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { OrgId } from '../auth/decorators/org-id.decorator'
import { SubscriptionService } from './subscription.service'
import { AdminApiService } from '../admin-api/admin-api.service'
import { ChangePlanDto } from '../admin-api/dto/change-plan.dto'

@ApiBearerAuth()
@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly adminApiService: AdminApiService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Status da assinatura e features disponíveis para a organização' })
  getStatus(@OrgId() organizationId: string) {
    return this.subscriptionService.getSubscription(organizationId)
  }

  @Patch('plan')
  @ApiOperation({ summary: 'Trocar de plano' })
  async changePlan(@OrgId() organizationId: string, @Body() dto: ChangePlanDto) {
    const result = await this.adminApiService.changePlan(organizationId, dto.planId)
    await this.subscriptionService.invalidateCache(organizationId)
    return result
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar assinatura' })
  async cancelSubscription(@OrgId() organizationId: string) {
    const result = await this.adminApiService.cancelSubscription(organizationId)
    await this.subscriptionService.invalidateCache(organizationId)
    return result
  }
}
