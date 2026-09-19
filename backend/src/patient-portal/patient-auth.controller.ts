import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PatientActivationService } from './patient-activation.service';
import { PatientAuthService } from './patient-auth.service';
import { PatientActivateDto } from './dto/patient-activate.dto';
import { PatientLoginDto } from './dto/patient-login.dto';
import { PatientSelectLinkDto } from './dto/patient-select-link.dto';

@ApiTags('Patient Portal - Auth')
@Controller('patient-portal/auth')
export class PatientAuthController {
  constructor(
    private readonly authService: PatientAuthService,
    private readonly activationService: PatientActivationService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Login da paciente via CPF + senha' })
  async login(@Body() dto: PatientLoginDto) {
    return this.authService.login(dto.cpf, dto.password);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('select-link')
  @ApiOperation({ summary: 'Escolher a clínica após login com mais de um vínculo ativo' })
  async selectLink(@Body() dto: PatientSelectLinkDto) {
    return this.authService.selectLink(dto.preAuthToken, dto.linkId);
  }

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
