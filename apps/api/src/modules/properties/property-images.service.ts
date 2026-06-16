import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../auth/types/jwt-payload.interface';

@Injectable()
export class PropertyImagesService {
  constructor(private readonly prisma: PrismaService) {}

  async addImages(
    user: AuthUser,
    propertyId: string,
    files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se recibieron imágenes');
    }
    await this.getOwnedProperty(user, propertyId);

    const count = await this.prisma.property_images.count({
      where: { property_id: propertyId },
    });
    const hasMain =
      (await this.prisma.property_images.count({
        where: { property_id: propertyId, is_main: true },
      })) > 0;

    // La primera imagen se marca como principal solo si aún no hay una.
    return this.prisma.$transaction(
      files.map((file, index) =>
        this.prisma.property_images.create({
          data: {
            property_id: propertyId,
            url: `/uploads/${file.filename}`,
            is_main: !hasMain && index === 0,
            sort_order: count + index,
          },
        }),
      ),
    );
  }

  async setMain(user: AuthUser, propertyId: string, imageId: string) {
    await this.getOwnedProperty(user, propertyId);
    const image = await this.prisma.property_images.findFirst({
      where: { id: imageId, property_id: propertyId },
    });
    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }
    await this.prisma.$transaction([
      this.prisma.property_images.updateMany({
        where: { property_id: propertyId, is_main: true },
        data: { is_main: false },
      }),
      this.prisma.property_images.update({
        where: { id: imageId },
        data: { is_main: true },
      }),
    ]);
    return { message: 'Imagen principal actualizada' };
  }

  async reorder(user: AuthUser, propertyId: string, imageIds: string[]) {
    await this.getOwnedProperty(user, propertyId);
    const images = await this.prisma.property_images.findMany({
      where: { property_id: propertyId },
      select: { id: true },
    });
    const valid = new Set(images.map((i) => i.id));
    if (imageIds.some((id) => !valid.has(id))) {
      throw new BadRequestException(
        'La lista contiene imágenes que no pertenecen a la propiedad',
      );
    }
    await this.prisma.$transaction(
      imageIds.map((id, index) =>
        this.prisma.property_images.update({
          where: { id },
          data: { sort_order: index },
        }),
      ),
    );
    return this.prisma.property_images.findMany({
      where: { property_id: propertyId },
      orderBy: { sort_order: 'asc' },
    });
  }

  async remove(user: AuthUser, propertyId: string, imageId: string) {
    await this.getOwnedProperty(user, propertyId);
    const image = await this.prisma.property_images.findFirst({
      where: { id: imageId, property_id: propertyId },
    });
    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }

    await this.prisma.property_images.delete({ where: { id: imageId } });

    // Borrado best-effort del archivo en disco.
    if (image.url.startsWith('/uploads/')) {
      const filename = image.url.replace('/uploads/', '');
      try {
        await unlink(join(process.cwd(), 'uploads', filename));
      } catch {
        /* el archivo puede no existir; se ignora */
      }
    }

    // Si era la principal, promover la siguiente.
    if (image.is_main) {
      const next = await this.prisma.property_images.findFirst({
        where: { property_id: propertyId },
        orderBy: { sort_order: 'asc' },
      });
      if (next) {
        await this.prisma.property_images.update({
          where: { id: next.id },
          data: { is_main: true },
        });
      }
    }
    return { message: 'Imagen eliminada' };
  }

  private async getOwnedProperty(user: AuthUser, propertyId: string) {
    const property = await this.prisma.properties.findUnique({
      where: { id: propertyId },
    });
    if (!property) {
      throw new NotFoundException('Propiedad no encontrada');
    }
    if (property.owner_id !== user.id && !user.roles.includes('admin')) {
      throw new ForbiddenException('No tienes permiso sobre esta propiedad');
    }
    return property;
  }
}
