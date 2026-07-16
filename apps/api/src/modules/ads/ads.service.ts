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
    data: { title: string; link_url?: string },
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

    return this.prisma.ads.create({
      data: {
        company_id: company.id,
        title: data.title,
        link_url: data.link_url,
        image_url: `/uploads/${file.filename}`,
        views_purchased: remaining,
        ends_at: sub.end_date,
      },
    });
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
   * Anuncio aleatorio elegible (activo, vigente y con vistas disponibles).
   * Cada entrega descuenta una vista.
   */
  async serve() {
    const eligible = await this.prisma.ads.findMany({
      where: {
        status: 'active',
        OR: [{ ends_at: null }, { ends_at: { gt: new Date() } }],
      },
      include: { companies: { select: { name: true, logo_url: true } } },
    });
    const withViews = eligible.filter((a) => a.views_used < a.views_purchased);
    if (withViews.length === 0) return null;

    const ad = withViews[Math.floor(Math.random() * withViews.length)];
    // Descuento atómico; si otra request agotó el cupo, no pasa de purchased
    await this.prisma.ads.updateMany({
      where: { id: ad.id, views_used: { lt: ad.views_purchased } },
      data: { views_used: { increment: 1 } },
    });

    return {
      id: ad.id,
      title: ad.title,
      image_url: ad.image_url,
      link_url: ad.link_url,
      company: ad.companies,
    };
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
