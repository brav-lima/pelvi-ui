import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { OrgId } from '../auth/decorators/org-id.decorator'
import { AdminApiService } from './admin-api.service'

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
}
