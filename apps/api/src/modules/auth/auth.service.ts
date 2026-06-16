import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { users } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RoleMode, SessionContext } from './types/jwt-payload.interface';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  async register(dto: RegisterDto, ctx: SessionContext) {
    const existing = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Una sola cuenta opera como comprador y propietario (§4.2): asigna ambos roles.
    const user = await this.prisma.users.create({
      data: {
        name: dto.name,
        email: dto.email,
        password_hash,
        phone: dto.phone,
        city: dto.city,
        status: 'active',
        active_role: 'buyer',
        user_roles: {
          create: [
            { roles: { connect: { name: 'buyer' } } },
            { roles: { connect: { name: 'owner' } } },
          ],
        },
      },
    });

    const roles = ['buyer', 'owner'];
    const tokens = await this.issueTokens(user, roles, ctx);
    return { user: this.sanitize(user), roles, ...tokens };
  }

  async login(dto: LoginDto, ctx: SessionContext) {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (user.status === 'blocked') {
      throw new UnauthorizedException('Cuenta bloqueada');
    }
    if (user.status === 'suspended') {
      throw new UnauthorizedException('Cuenta suspendida');
    }

    await this.prisma.users.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const roles = await this.getUserRoles(user.id);
    const tokens = await this.issueTokens(user, roles, ctx);
    return { user: this.sanitize(user), roles, ...tokens };
  }

  async refresh(refreshToken: string, ctx: SessionContext) {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const stored = await this.prisma.refresh_tokens.findFirst({
      where: {
        user_id: payload.sub,
        token_hash: this.sha256(refreshToken),
        revoked_at: null,
      },
    });
    if (!stored) {
      throw new UnauthorizedException('Sesión expirada o revocada');
    }
    if (stored.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    // Rotación: revoca el token usado y emite uno nuevo.
    await this.prisma.refresh_tokens.update({
      where: { id: stored.id },
      data: { revoked_at: new Date() },
    });

    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const roles = await this.getUserRoles(user.id);
    return this.issueTokens(user, roles, ctx);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refresh_tokens.updateMany({
        where: {
          user_id: userId,
          token_hash: this.sha256(refreshToken),
          revoked_at: null,
        },
        data: { revoked_at: new Date() },
      });
    } else {
      await this.prisma.refresh_tokens.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    }
    return { message: 'Sesión cerrada' };
  }

  async me(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: { user_roles: { include: { roles: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    const { user_roles, ...rest } = user;
    return {
      ...this.sanitize(rest as users),
      roles: user_roles.map((ur) => ur.roles.name),
    };
  }

  async switchRole(userId: string, role: RoleMode) {
    const roles = await this.getUserRoles(userId);
    if (!roles.includes(role)) {
      throw new ForbiddenException(`No tienes habilitado el rol "${role}"`);
    }
    const user = await this.prisma.users.update({
      where: { id: userId },
      data: { active_role: role },
    });
    return { active_role: user.active_role };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });
    // Respuesta genérica: no revelar si el email existe.
    const generic = {
      message: 'Si el email existe, se enviará un enlace de recuperación.',
    };
    if (!user) {
      return generic;
    }

    const token = randomBytes(32).toString('hex');
    await this.prisma.password_reset_tokens.create({
      data: {
        user_id: user.id,
        token_hash: this.sha256(token),
        expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    // TODO: enviar el token por email (§14). En desarrollo se devuelve para pruebas.
    if (this.config.get('NODE_ENV') !== 'production') {
      return { ...generic, devResetToken: token };
    }
    return generic;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.prisma.password_reset_tokens.findFirst({
      where: { token_hash: this.sha256(dto.token), used_at: null },
      orderBy: { created_at: 'desc' },
    });
    if (!row || row.expires_at < new Date()) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.users.update({
        where: { id: row.user_id },
        data: { password_hash },
      }),
      this.prisma.password_reset_tokens.update({
        where: { id: row.id },
        data: { used_at: new Date() },
      }),
      // Cierra todas las sesiones tras cambiar la contraseña.
      this.prisma.refresh_tokens.updateMany({
        where: { user_id: row.user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);

    return { message: 'Contraseña actualizada correctamente' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Google OAuth
  // ──────────────────────────────────────────────────────────────────────────

  async googleAuth(idToken: string, ctx: SessionContext) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
    }).catch(() => {
      throw new UnauthorizedException('Token de Google inválido');
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Token de Google sin email');
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name ?? email.split('@')[0];
    const avatar = payload.picture;

    // 1. Buscar por google_id
    let user = await this.prisma.users.findFirst({
      where: { google_id: googleId },
    });

    if (!user) {
      // 2. Buscar por email (vincular cuenta existente)
      user = await this.prisma.users.findUnique({ where: { email } });

      if (user) {
        // Vincular google_id a cuenta existente
        user = await this.prisma.users.update({
          where: { id: user.id },
          data: {
            google_id: googleId,
            ...(avatar && !user.avatar_url ? { avatar_url: avatar } : {}),
            ...(!user.email_verified_at && payload.email_verified
              ? { email_verified_at: new Date() }
              : {}),
          },
        });
      } else {
        // 3. Crear cuenta nueva
        const randomPassword = randomBytes(32).toString('hex');
        const password_hash = await bcrypt.hash(randomPassword, BCRYPT_ROUNDS);

        user = await this.prisma.users.create({
          data: {
            name,
            email,
            password_hash,
            google_id: googleId,
            avatar_url: avatar,
            status: 'active',
            active_role: 'buyer',
            email_verified_at: payload.email_verified ? new Date() : undefined,
            user_roles: {
              create: [
                { roles: { connect: { name: 'buyer' } } },
                { roles: { connect: { name: 'owner' } } },
              ],
            },
          },
        });
      }
    }

    if (user.status === 'blocked') {
      throw new UnauthorizedException('Cuenta bloqueada');
    }
    if (user.status === 'suspended') {
      throw new UnauthorizedException('Cuenta suspendida');
    }

    await this.prisma.users.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const roles = await this.getUserRoles(user.id);
    const tokens = await this.issueTokens(user, roles, ctx);
    return { user: this.sanitize(user), roles, ...tokens };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async getUserRoles(userId: string): Promise<string[]> {
    const rows = await this.prisma.user_roles.findMany({
      where: { user_id: userId },
      include: { roles: true },
    });
    return rows.map((r) => r.roles.name);
  }

  private async issueTokens(
    user: users,
    roles: string[],
    ctx: SessionContext,
  ) {
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        active_role: user.active_role,
        roles,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.config.get<string>('JWT_ACCESS_TTL') ?? '15m') as any,
      },
    );

    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.config.get<string>('JWT_REFRESH_TTL') ?? '7d') as any,
      },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refresh_tokens.create({
      data: {
        user_id: user.id,
        token_hash: this.sha256(refreshToken),
        user_agent: ctx.ua,
        ip_address: ctx.ip,
        expires_at: new Date(decoded.exp * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
    };
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private sanitize(user: users) {
    const { password_hash, ...rest } = user;
    return rest;
  }
}
