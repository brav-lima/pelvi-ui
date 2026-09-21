import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequireFeature } from '../subscription/decorators/require-feature.decorator';
import { PatientInviteService } from './patient-invite.service';

@RequireFeature('PATIENT_PORTAL')
@ApiBearerAuth()
@ApiTags('Patient Portal - Convites')
@RequireFeature('PATIENT_PORTAL')
@Controller('patient-portal')
export class PatientInviteController {
  constructor(private readonly inviteService: PatientInviteService) {}

  @Post('patients/:patientId/invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convidar paciente para o app (cria conta ou novo vínculo)' })
  async invite(
    @CurrentUser() user: JwtPayload,
    @OrgId() orgId: string,
    @Param('patientId') patientId: string,
  ) {
    await this.inviteService.invite(user.sub, orgId, patientId);
    return { message: 'Convite enviado' };
  }

  @Post('links/:linkId/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar uma solicitação de vínculo recusada' })
  async resend(
    @CurrentUser() user: JwtPayload,
    @OrgId() orgId: string,
    @Param('linkId') linkId: string,
  ) {
    await this.inviteService.resend(user.sub, orgId, linkId);
    return { message: 'Solicitação reenviada' };
  }
}
