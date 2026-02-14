import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SelectOrganizationDto } from './dto/select-organization.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './strategies/jwt.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Login via CPF + senha',
    description:
      'Se o CPF está vinculado a 1 clínica, retorna accessToken. ' +
      'Se vinculado a N clínicas, retorna lista de organizações (sem token). ' +
      'O frontend deve chamar /select-organization para escolher.',
  })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'CPF ou senha inválidos / nenhuma clínica vinculada' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('select-organization')
  @ApiOperation({
    summary: 'Selecionar organização após login multi-clínica',
    description: 'Gera JWT com contexto da organização escolhida.',
  })
  @ApiResponse({ status: 200, description: 'Token gerado com sucesso' })
  @ApiResponse({ status: 401, description: 'Vínculo inválido ou inativo' })
  selectOrganization(@Body() dto: SelectOrganizationDto) {
    return this.authService.selectOrganization(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Retorna perfil do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil retornado' })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user);
  }
}
