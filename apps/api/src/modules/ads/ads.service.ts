import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /** Suscripción de empresa activa, o 403. */
  private async requireBusinessSubscription(userId: string) {
    const sub = await this.subscriptions.getActiveSubscription(userId);
    if (!sub || !sub.subscription_plans.is_business) {
      throw new ForbiddenException(
        'Necesitas el plan Empresas activo para gestionar publicidad',
      );
    }
    return sub;
  }

  // ── Empresa ─────────────────────────────────────────────────────────────────

  async createCompany(
    userId: string,
    data: { name: string; website?: string; logo_url?: string },
  ) {
    await this.requireBusinessSubscription(userId);
    const existing = await this.prisma.companies.findUnique({
      where: { user_id: userId },
    });
    if (existing) {
      return this.prisma.companies.update({
        where: { user_id: userId },
        data: { name: data.name, website: data.website, logo_url: data.logo_url },
      });
    }
    return this.prisma.companies.create({
      data: { user_id: userId, ...data },
    });
  }

  async myCompany(userId: string) {
    return this.prisma.companies.findUnique({
      where: { user_id: userId },
      include: { ads: { orderBy: { created_at: 'desc' } } },
    });
  }

  // ── Anuncios ────────────────────────────────────────────────────────────────

  async createAd(
    userId: string,
    data: { title: string; link_url?: string; zone_ids?: string },
    file: Express.Multer.File,
  ) {
    const sub = await this.requireBusinessSubscription(userId);
    const company = await this.prisma.companies.findUnique({
      where: { user_id: userId },
    });
    if (!company) {
      throw new BadRequestException('Primero crea tu empresa');
    }
    if (!file) {
      throw new BadRequestException('El anuncio necesita una imagen');
    }
    if (data.link_url && !/^https?:\/\//i.test(data.link_url)) {
      throw new BadRequestException('El link debe empezar con http:// o https://');
    }

    // zone_ids llega como JSON (multipart no maneja bien arrays de forma nativa)
    let zoneIds: string[] = [];
    if (data.zone_ids) {
      try {
        const parsed = JSON.parse(data.zone_ids);
        if (Array.isArray(parsed)) zoneIds = parsed.filter((z) => typeof z === 'string');
      } catch {
        throw new BadRequestException('zone_ids inválido');
      }
    }

    // Las vistas del plan se reparten entre los anuncios de la suscripción:
    // cada anuncio nuevo recibe el cupo completo restante del plan menos lo
    // ya asignado en este periodo.
    const assigned = await this.prisma.ads.aggregate({
      where: {
        company_id: company.id,
        created_at: { gte: sub.start_date ?? undefined },
      },
      _sum: { views_purchased: true },
    });
    const remaining =
      sub.subscription_plans.ad_views - (assigned._sum.views_purchased ?? 0);
    if (remaining <= 0) {
      throw new ForbiddenException(
        'Ya usaste todas las vistas de publicidad de tu plan. Renueva para seguir.',
      );
    }

    const ad = await this.prisma.ads.create({
      data: {
        company_id: company.id,
        title: data.title,
        link_url: data.link_url,
        image_url: `/uploads/${file.filename}`,
        views_purchased: remaining,
        ends_at: sub.end_date,
      },
    });

    if (zoneIds.length > 0) {
      const validZones = await this.prisma.zones.findMany({
        where: { id: { in: zoneIds } },
        select: { id: true },
      });
      if (validZones.length > 0) {
        await this.prisma.ad_zones.createMany({
          data: validZones.map((z) => ({ ad_id: ad.id, zone_id: z.id })),
          skipDuplicates: true,
        });
      }
    }

    return ad;
  }

  async setAdStatus(userId: string, adId: string, status: 'active' | 'paused') {
    const ad = await this.prisma.ads.findUnique({
      where: { id: adId },
      include: { companies: true },
    });
    if (!ad || ad.companies.user_id !== userId) {
      throw new NotFoundException('Anuncio no encontrado');
    }
    return this.prisma.ads.update({ where: { id: adId }, data: { status } });
  }

  // ── Serving público ─────────────────────────────────────────────────────────

  /**
   * Hasta `count` anuncios distintos, elegibles (activos, vigentes y con
   * vistas disponibles). Cada entrega descuenta una vista.
   *
   * Si se pasa la ubicación del cliente (lat/lng): prioriza anuncios cuyo
   * dueño eligió la zona más cercana al cliente ("su sector"); si ninguno
   * apunta exactamente ahí, usa los anuncios con zona más cercana; si
   * tampoco hay, cae a los anuncios sin zonas (globales, se muestran en
   * cualquier lado). Sin ubicación, se comporta como antes (aleatorio total).
   */
  async serve(count = 1, lat?: number, lng?: number) {
    const take = Math.max(1, Math.min(count, 10));
    const eligible = await this.prisma.ads.findMany({
      where: {
        status: 'active',
        OR: [{ ends_at: null }, { ends_at: { gt: new Date() } }],
      },
      include: {
        companies: { select: { name: true, logo_url: true } },
        ad_zones: {
          include: { zones: { select: { id: true, latitude: true, longitude: true } } },
        },
      },
    });
    const withViews = eligible.filter((a) => a.views_used < a.views_purchased);
    if (withViews.length === 0) return [];

    let picked: typeof withViews;

    const targeted = withViews.filter((a) => a.ad_zones.length > 0);
    const global = withViews.filter((a) => a.ad_zones.length === 0);

    if (lat != null && lng != null && targeted.length > 0) {
      const zones = await this.prisma.zones.findMany({
        where: { is_active: true, latitude: { not: null }, longitude: { not: null } },
        select: { id: true, latitude: true, longitude: true },
      });
      let nearestZoneId: string | null = null;
      let nearestDist = Infinity;
      for (const z of zones) {
        const d = this.haversineKm(lat, lng, Number(z.latitude), Number(z.longitude));
        if (d < nearestDist) {
          nearestDist = d;
          nearestZoneId = z.id;
        }
      }

      const exact = targeted.filter((a) =>
        a.ad_zones.some((az) => az.zone_id === nearestZoneId),
      );

      let primary: typeof withViews;
      if (exact.length > 0) {
        primary = exact;
      } else {
        // Sin match exacto: ordenar por cercanía a cualquiera de sus zonas
        const withDist = targeted
          .map((a) => {
            const dist = Math.min(
              ...a.ad_zones.map((az) =>
                az.zones.latitude != null && az.zones.longitude != null
                  ? this.haversineKm(lat, lng, Number(az.zones.latitude), Number(az.zones.longitude))
                  : Infinity,
              ),
            );
            return { ad: a, dist };
          })
          .sort((x, y) => x.dist - y.dist);
        primary = withDist.slice(0, Math.max(take * 3, take)).map((x) => x.ad);
      }

      picked = this.fillUpTo(take, this.shuffle(primary), this.shuffle(global), this.shuffle(withViews));
    } else {
      picked = this.fillUpTo(take, this.shuffle(withViews));
    }

    // Descuento atómico; si otra request agotó el cupo, no pasa de purchased
    await Promise.all(
      picked.map((ad) =>
        this.prisma.ads.updateMany({
          where: { id: ad.id, views_used: { lt: ad.views_purchased } },
          data: { views_used: { increment: 1 } },
        }),
      ),
    );

    return picked.map((ad) => ({
      id: ad.id,
      title: ad.title,
      image_url: ad.image_url,
      link_url: ad.link_url,
      company: ad.companies,
    }));
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Combina pools en orden de prioridad hasta juntar `take` ids únicos. */
  private fillUpTo<T extends { id: string }>(take: number, ...pools: T[][]): T[] {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const pool of pools) {
      for (const item of pool) {
        if (result.length >= take) break;
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        result.push(item);
      }
      if (result.length >= take) break;
    }
    return result;
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  adminList() {
    return this.prisma.ads.findMany({
      include: { companies: { select: { name: true, user_id: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  async adminSetStatus(adId: string, status: 'active' | 'paused') {
    const ad = await this.prisma.ads.findUnique({ where: { id: adId } });
    if (!ad) throw new NotFoundException('Anuncio no encontrado');
    return this.prisma.ads.update({ where: { id: adId }, data: { status } });
  }
}
