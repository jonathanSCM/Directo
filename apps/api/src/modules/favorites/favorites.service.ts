import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async toggle(userId: string, propertyId: string) {
    const existing = await this.prisma.favorites.findUnique({
      where: { user_id_property_id: { user_id: userId, property_id: propertyId } },
    });

    if (existing) {
      await this.prisma.favorites.delete({
        where: { user_id_property_id: { user_id: userId, property_id: propertyId } },
      });
      return { saved: false };
    }

    await this.prisma.favorites.create({
      data: { user_id: userId, property_id: propertyId },
    });
    return { saved: true };
  }

  async list(userId: string) {
    const rows = await this.prisma.favorites.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        properties: {
          include: {
            property_types: true,
            zones: true,
            property_images: { orderBy: { sort_order: 'asc' }, take: 1 },
          },
        },
      },
    });

    return rows
      .filter((r) => r.properties !== null)
      .map((r) => {
        const p = r.properties!;
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          operation: p.operation,
          price: Number(p.price),
          currency: p.currency,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          area_m2: p.area_m2 ? Number(p.area_m2) : null,
          address: p.address,
          latitude: p.latitude ? Number(p.latitude) : null,
          longitude: p.longitude ? Number(p.longitude) : null,
          status: p.status,
          property_type: p.property_types?.name ?? null,
          zone: p.zones?.name ?? null,
          image: p.property_images?.[0]?.url ?? null,
          saved_at: r.created_at,
        };
      });
  }

  async listIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.favorites.findMany({
      where: { user_id: userId },
      select: { property_id: true },
    });
    return rows.map((r) => r.property_id);
  }

  async isSaved(userId: string, propertyId: string): Promise<boolean> {
    const row = await this.prisma.favorites.findUnique({
      where: { user_id_property_id: { user_id: userId, property_id: propertyId } },
    });
    return !!row;
  }
}
