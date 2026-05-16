import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { OrgId } from '../auth/decorators/org-id.decorator'
import { AdminApiService } from './admin-api.service'
import { ChangePlanDto } from './dto/change-plan.dto'

@ApiBearerAuth()
@ApiTags('Subscription')
@Controller('subscription')
export class AdminApiController {
  constructor(private readonly service: AdminApiService) {}

  @Get()
  @ApiOperation({ summary: 'Dados da assinatura ativa da organização' })
  @ApiResponse({ status: 200, description: 'Assinatura retornada' })
  @ApiResponse({ status: 404, description: 'Assinatura não encontrada' })
  getSubscription(@OrgId() organizationId: string) {
    return this.service.getSubscription(organizationId)
  }

  @Get('plans')
  @ApiOperation({ summary: 'Listar planos disponíveis' })
  @ApiResponse({ status: 200, description: 'Lista de planos' })
  getPlans() {
    return this.service.getPlans()
  }

  @Patch('plan')
  @ApiOperation({ summary: 'Trocar de plano' })
  @ApiResponse({ status: 200, description: 'Plano alterado' })
  changePlan(@OrgId() organizationId: string, @Body() dto: ChangePlanDto) {
    return this.service.changePlan(organizationId, dto.planId)
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar assinatura' })
  @ApiResponse({ status: 200, description: 'Assinatura cancelada' })
  cancelSubscription(@OrgId() organizationId: string) {
    return this.service.cancelSubscription(organizationId)
  }
}
