import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: { user_roles: { include: { roles: true } } },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const { password_hash, user_roles, ...rest } = user;
    return { ...rest, roles: user_roles.map((ur) => ur.roles.name) };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.users.update({
      where: { id: userId },
      data: {
        name: dto.name,
        phone: dto.phone,
        city: dto.city,
        avatar_url: dto.avatar_url,
      },
    });
    const { password_hash, ...rest } = user;
    return rest;
  }

  async updateAvatar(userId: string, file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se recibió la imagen');
    }
    const user = await this.prisma.users.update({
      where: { id: userId },
      data: { avatar_url: `/uploads/${file.filename}` },
    });
    const { password_hash, ...rest } = user;
    return rest;
  }

  /**
   * El token es único por dispositivo, no por usuario: si el mismo celular
   * cierra sesión y entra con otra cuenta, el token se reasigna (upsert por
   * `token`) en vez de acumular filas huérfanas.
   */
  async registerPushToken(userId: string, dto: RegisterPushTokenDto) {
    await this.prisma.push_tokens.upsert({
      where: { token: dto.token },
      create: { user_id: userId, token: dto.token, platform: dto.platform },
      update: { user_id: userId, platform: dto.platform },
    });
    return { success: true };
  }

  async unregisterPushToken(token: string) {
    await this.prisma.push_tokens.deleteMany({ where: { token } });
    return { success: true };
  }
}
