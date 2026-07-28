import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SwitchRoleDto } from './dto/switch-role.dto';
import type { AuthUser, SessionContext } from './types/jwt-payload.interface';

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private ctx(req: Request): SessionContext {
    return { ua: req.headers['user-agent'], ip: req.ip };
  }

  /**
   * El panel admin (navegador) ya no guarda los tokens en JS — llegan acá
   * como cookies httpOnly, invisibles para un XSS. La app móvil sigue
   * usando el accessToken/refreshToken del body de la respuesta (header
   * Authorization + expo-secure-store); ambos mecanismos conviven porque
   * la API no sabe (ni le hace falta saber) qué cliente la llamó.
   */
  private setAuthCookies(res: Response, tokens: IssuedTokens) {
    const secure = this.config.get('NODE_ENV') === 'production';
    const base: CookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
    res.cookie('access_token', tokens.accessToken, {
      ...base,
      expires: tokens.accessTokenExpiresAt,
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      ...base,
      expires: tokens.refreshTokenExpiresAt,
    });
  }

  private clearAuthCookies(res: Response) {
    const secure = this.config.get('NODE_ENV') === 'production';
    const base: CookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
    res.clearCookie('access_token', base);
    res.clearCookie('refresh_token', base);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, this.ctx(req));
    this.setAuthCookies(res, result);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, this.ctx(req));
    this.setAuthCookies(res, result);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar el access token con un refresh token' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = dto.refreshToken || req.cookies?.refresh_token;
    if (!token) {
      throw new BadRequestException('Falta el refresh token');
    }
    const result = await this.authService.refresh(token, this.ctx(req));
    this.setAuthCookies(res, result);
    return result;
  }

  @Public()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Cerrar sesión (revoca refresh tokens)' })
  async logout(
    @CurrentUser('id') userId: string | undefined,
    @Body() dto: LogoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearAuthCookies(res);
    const token = dto.refreshToken || req.cookies?.refresh_token;
    // Sin usuario autenticado (cookie/token ya inválido) no hay nada que
    // revocar en BD, pero igual limpiamos las cookies arriba.
    if (!userId) {
      return { message: 'Sesión cerrada' };
    }
    return this.authService.logout(userId, token);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @ApiBearerAuth()
  @Patch('switch-role')
  @ApiOperation({ summary: 'Cambiar el modo activo comprador/propietario' })
  switchRole(@CurrentUser('id') userId: string, @Body() dto: SwitchRoleDto) {
    return this.authService.switchRole(userId, dto.role);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('google')
  @ApiOperation({ summary: 'Iniciar sesión o registrarse con Google' })
  async google(
    @Body() dto: GoogleAuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.googleAuth(dto.idToken, this.ctx(req));
    this.setAuthCookies(res, result);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  @ApiOperation({ summary: 'Restablecer la contraseña con un token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
