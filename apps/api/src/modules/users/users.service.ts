import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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
}
