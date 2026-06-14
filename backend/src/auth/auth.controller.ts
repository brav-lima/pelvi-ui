import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SelectOrganizationDto } from './dto/select-organization.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { CurrentRefreshUser } from './decorators/current-refresh-user.decorator';
import type { RefreshUser } from './decorators/current-refresh-user.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import type { JwtPayload } from './strategies/jwt.strategy';
import { ACCESS_COOKIE_NAME } from './strategies/jwt.strategy';

const REFRESH_COOKIE_NAME = 'pelvi_refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth';
const ACCESS_TOKEN_MAX_AGE_MS = 60 * 60 * 1000;
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

function decodeJtiFromToken(token: string): string | null {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return null;
    const decoded = JSON.parse(
      Buffer.from(payloadSegment, 'base64url').toString('utf8'),
    ) as { jti?: string };
    return decoded?.jti ?? null;
  } catch {
    return null;
  }
}

function clearAuthCookies(res: Response) {
  res.cookie(ACCESS_COOKIE_NAME, '', { httpOnly: true, secure: isProd(), sameSite: 'strict', maxAge: 0 });
  res.cookie(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'strict',
    maxAge: 0,
    path: REFRESH_COOKIE_PATH,
  });
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiOperation({
    summary: 'Renovar access token via refresh token (cookie)',
    description:
      'Valida o refresh token do cookie httpOnly, revoga a linha corrente em refresh_tokens, ' +
      'emite novo par e atualiza os cookies. Apresentar um refresh já revogado revoga toda a família.',
  })
  @ApiResponse({ status: 200, description: 'Tokens renovados com sucesso' })
  @ApiResponse({ status: 401, description: 'Refresh token ausente, inválido, revogado ou expirado' })
  async refresh(
    @CurrentRefreshUser() refreshUser: RefreshUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.rotateRefreshToken(
      refreshUser.personId,
      refreshUser.organizationId,
      refreshUser.jti,
    );
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { ok: true };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({
    summary: 'Encerra a sessão revogando o refresh corrente e limpando os cookies',
  })
  @ApiResponse({ status: 200, description: 'Sessão encerrada' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const accessToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;

    if (refreshToken) {
      const refreshJti = decodeJtiFromToken(refreshToken);
      const accessJti = accessToken ? decodeJtiFromToken(accessToken) : undefined;
      if (refreshJti) {
        await this.authService.revokeRefreshToken(refreshJti, accessJti ?? undefined);
      }
    }
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
  @Throttle({ default: { ttl: 60000, limit: 5 } })
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

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Solicitar reset de senha por e-mail',
    description: 'Envia e-mail com link de redefinição. Sempre retorna 200 (não vaza se e-mail existe).',
  })
  @ApiResponse({ status: 200, description: 'Solicitação processada' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return { message: 'Se o e-mail estiver cadastrado, você receberá as instruções em breve.' };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  @ApiOperation({
    summary: 'Redefinir senha com token do e-mail',
  })
  @ApiResponse({ status: 200, description: 'Senha redefinida com sucesso' })
  @ApiResponse({ status: 400, description: 'Token inválido ou expirado' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Senha redefinida com sucesso' };
  }
}
