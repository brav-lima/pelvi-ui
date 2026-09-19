import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PatientActivationService } from './patient-activation.service';
import { PatientAuthService } from './patient-auth.service';
import { PatientActivateDto } from './dto/patient-activate.dto';
import { PatientLoginDto } from './dto/patient-login.dto';
import { PatientSelectLinkDto } from './dto/patient-select-link.dto';
import { PatientLogoutDto } from './dto/patient-logout.dto';
import { PatientJwtAuthGuard } from './guards/patient-jwt-auth.guard';
import { PatientJwtRefreshGuard } from './guards/patient-jwt-refresh.guard';
import { CurrentPatient } from './decorators/current-patient.decorator';
import { CurrentPatientRefreshUser } from './decorators/current-patient-refresh-user.decorator';
import type { PatientRefreshUser } from './decorators/current-patient-refresh-user.decorator';
import type { PatientJwtPayload } from './strategies/patient-jwt.strategy';

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

  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(PatientJwtRefreshGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar o access token via refresh token' })
  async refresh(@CurrentPatientRefreshUser() refreshUser: PatientRefreshUser) {
    return this.authService.rotateRefreshToken(refreshUser.accountId, refreshUser.linkId, refreshUser.jti);
  }

  @ApiBearerAuth()
  @Public()
  @UseGuards(PatientJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Encerrar a sessão da paciente' })
  async logout(@CurrentPatient() patient: PatientJwtPayload, @Body() dto: PatientLogoutDto) {
    await this.authService.logout(dto.refreshToken, patient.jti);
    return { message: 'Sessão encerrada' };
  }

  @ApiBearerAuth()
  @Public()
  @UseGuards(PatientJwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Sessão atual: vínculo ativo, clínicas e consentimentos pendentes' })
  async me(@CurrentPatient() patient: PatientJwtPayload) {
    return this.authService.getSession(patient);
  }
}
