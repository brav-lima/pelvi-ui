import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SelectOrganizationDto } from './dto/select-organization.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './strategies/jwt.strategy';
import { ACCESS_COOKIE_NAME } from './strategies/jwt.strategy';

const REFRESH_COOKIE_NAME = 'careflow_refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const isProd = () => process.env.NODE_ENV === 'production';

const accessCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: 'strict',
  maxAge: ACCESS_TOKEN_MAX_AGE_MS,
});

const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: 'strict',
  maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  path: REFRESH_COOKIE_PATH,
});

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, accessCookieOptions());
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE_NAME, { httpOnly: true, sameSite: 'strict' });
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  });
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @ApiOperation({
    summary: 'Login via CPF + senha',
    description:
      'Se o CPF está vinculado a 1 clínica, seta cookies httpOnly de auth e retorna perfil. ' +
      'Se vinculado a N clínicas, retorna lista de organizações (sem cookies). ' +
      'O frontend deve chamar /select-organization para escolher.',
  })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'CPF ou senha inválidos / nenhuma clínica vinculada' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    if (result.accessToken && result.refreshToken) {
      setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    const { accessToken: _a, refreshToken: _r, ...body } = result;
    return body;
  }

  @Public()
  @Post('select-organization')
  @ApiOperation({
    summary: 'Selecionar organização após login multi-clínica',
    description: 'Seta cookies httpOnly com contexto da organização escolhida.',
  })
  @ApiResponse({ status: 200, description: 'Sessão iniciada com sucesso' })
  @ApiResponse({ status: 401, description: 'Vínculo inválido ou inativo' })
  async selectOrganization(
    @Body() dto: SelectOrganizationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.selectOrganization(dto);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    const { accessToken: _a, refreshToken: _r, ...body } = result;
    return body;
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary: 'Renovar access token via refresh token (cookie)',
    description: 'Lê o refresh token do cookie httpOnly e seta um novo par.',
  })
  @ApiResponse({ status: 200, description: 'Tokens renovados com sucesso' })
  @ApiResponse({ status: 401, description: 'Refresh token ausente, inválido ou expirado' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token ausente');
    }
    const tokens = await this.authService.refreshAccessToken({ refreshToken });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { ok: true };
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Encerra a sessão limpando os cookies de auth' })
  @ApiResponse({ status: 200, description: 'Sessão encerrada' })
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookies(res);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Retorna perfil do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil retornado' })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user);
  }

  @ApiBearerAuth()
  @Patch('profile')
  @ApiOperation({ summary: 'Atualizar perfil (nome, email, telefone)' })
  @ApiResponse({ status: 200, description: 'Perfil atualizado' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado' })
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user, dto);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: 'Alterar senha (requer senha atual)' })
  @ApiResponse({ status: 200, description: 'Senha alterada com sucesso' })
  @ApiResponse({ status: 401, description: 'Senha atual incorreta' })
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user, dto);
  }
}
