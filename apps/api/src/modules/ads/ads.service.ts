import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/**
 * Cupo de vistas que se le asigna a un anuncio "casa" (creado por el admin):
 * un número lo bastante alto para que en la práctica nunca sea el motivo de
 * que un anuncio deje de mostrarse — el control real es `status`/`ends_at`.
 */
const HOUSE_AD_VIEWS = 1_000_000_000;

/** Key en la tabla genérica `settings` donde se guarda el id de la empresa "casa". */
const HOUSE_COMPANY_SETTINGS_KEY = 'ads.house_company_id';

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /**
   * El marketplace self-service (empresa externa compra plan "Empresas" y
   * gestiona sus propios anuncios) sigue desactivado por decisión de
   * producto — se bloquea acá para que nadie con una suscripción de empresa
   * vieja pueda crear/editar empresas o anuncios propios llamando a la API
   * directamente. La publicidad "casa" (admin) usa un camino aparte que no
   * pasa por acá, ver `adminCreateAd`.
   */
  private async requireBusinessSubscription(
    _userId: string,
  ): Promise<NonNullable<Awaited<ReturnType<SubscriptionsService['getActiveSubscription']>>>> {
    throw new ForbiddenException('La publicidad de empresas está desactivada');
  }

  /**
   * Empresa interna usada como dueña de los anuncios que carga el admin a
   * mano (sin marketplace de por medio). Se crea una sola vez y su id se
   * guarda en `settings` para no depender de qué usuario admin la creó.
   */
  private async getOrCreateHouseCompany() {
    const setting = await this.prisma.settings.findUnique({
      where: { key: HOUSE_COMPANY_SETTINGS_KEY },
    });
    const savedId = (setting?.value as { companyId?: string } | null)?.companyId;
    if (savedId) {
      const existing = await this.prisma.companies.findUnique({ where: { id: savedId } });
      if (existing) return existing;
    }

    // Dueña técnica: el primer usuario admin (la FK companies.user_id la exige).
    const adminUser = await this.prisma.users.findFirst({
      where: { user_roles: { some: { roles: { name: 'admin' } } } },
      orderBy: { created_at: 'asc' },
    });
    if (!adminUser) {
      throw new BadRequestException('No hay un usuario admin para asociar la publicidad');
    }

    const company = await this.prisma.companies.upsert({
      where: { user_id: adminUser.id },
      create: { user_id: adminUser.id, name: 'DIRECTO' },
      update: {},
    });

    await this.prisma.settings.upsert({
      where: { key: HOUSE_COMPANY_SETTINGS_KEY },
      create: {
        key: HOUSE_COMPANY_SETTINGS_KEY,
        value: { companyId: company.id } as unknown as Prisma.InputJsonValue,
        description: 'Empresa interna dueña de los anuncios cargados por el admin',
      },
      update: { value: { companyId: company.id } as unknown as Prisma.InputJsonValue },
    });

    return company;
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

  /** Anuncio "casa" cargado directamente por el admin (sin empresa/suscripción externa). */
  async adminCreateAd(
    data: { title: string; link_url?: string; ends_at?: string; zone_ids?: string },
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('El anuncio necesita una imagen');
    }
    const company = await this.getOrCreateHouseCompany();

    let zoneIds: string[] = [];
    if (data.zone_ids) {
      try {
        const parsed = JSON.parse(data.zone_ids);
        if (Array.isArray(parsed)) zoneIds = parsed.filter((z) => typeof z === 'string');
      } catch {
        throw new BadRequestException('zone_ids inválido');
      }
    }

    const ad = await this.prisma.ads.create({
      data: {
        company_id: company.id,
        title: data.title,
        link_url: data.link_url,
        image_url: `/uploads/${file.filename}`,
        views_purchased: HOUSE_AD_VIEWS,
        ends_at: data.ends_at ? new Date(data.ends_at) : null,
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

  async adminUpdateAd(
    adId: string,
    data: { title?: string; link_url?: string; ends_at?: string; status?: 'active' | 'paused' },
    file?: Express.Multer.File,
  ) {
    const ad = await this.prisma.ads.findUnique({ where: { id: adId } });
    if (!ad) throw new NotFoundException('Anuncio no encontrado');
    return this.prisma.ads.update({
      where: { id: adId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.link_url !== undefined ? { link_url: data.link_url } : {}),
        ...(data.ends_at !== undefined ? { ends_at: data.ends_at ? new Date(data.ends_at) : null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(file ? { image_url: `/uploads/${file.filename}` } : {}),
      },
    });
  }

  async adminDeleteAd(adId: string) {
    const ad = await this.prisma.ads.findUnique({ where: { id: adId } });
    if (!ad) throw new NotFoundException('Anuncio no encontrado');
    await this.prisma.ads.delete({ where: { id: adId } });
    return { success: true };
  }
}
