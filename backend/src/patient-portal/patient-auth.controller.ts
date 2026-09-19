import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PatientActivationService } from './patient-activation.service';
import { PatientActivateDto } from './dto/patient-activate.dto';

@ApiTags('Patient Portal - Auth')
@Controller('patient-portal/auth')
export class PatientAuthController {
  constructor(private readonly activationService: PatientActivationService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('activate')
  @ApiOperation({ summary: 'Definir a senha e ativar a conta a partir do link de convite' })
  async activate(@Body() dto: PatientActivateDto) {
    await this.activationService.activate(dto.token, dto.password);
    return { message: 'Conta ativada com sucesso' };
  }
}
