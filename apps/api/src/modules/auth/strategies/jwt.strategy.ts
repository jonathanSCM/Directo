import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthUser, JwtPayload } from '../types/jwt-payload.interface';

/** Móvil manda el access token en el header Authorization; el panel admin
 * (navegador) ya no lo guarda en JS, así que llega en una cookie httpOnly. */
function cookieExtractor(req: Request): string | null {
  return req?.cookies?.access_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
      include: { user_roles: { include: { roles: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    if (user.status === 'blocked' || user.status === 'suspended') {
      throw new UnauthorizedException('La cuenta no está activa');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      active_role: user.active_role,
      status: user.status,
      roles: user.user_roles.map((ur) => ur.roles.name),
    };
  }
}
