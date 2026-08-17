import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PROPERTIES_PER_EMAIL = 6;

type NewProperty = {
  id: string;
  title: string;
  slug: string;
  price: unknown;
  currency: string;
  operation: string;
  owner_id: string;
  zones: { city: string; name: string } | null;
  property_images: { url: string }[];
};

/**
 * Cada lunes 9am: le manda a cada usuario (por la ciudad de su perfil) un
 * resumen de las propiedades publicadas en los últimos 7 días en esa ciudad.
 * Sin unsubscribe todavía — es un envío simple, no un centro de preferencias.
 */
@Injectable()
export class PropertyAlertsCron {
  private readonly logger = new Logger(PropertyAlertsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  @Cron('0 9 * * 1')
  async handleWeeklyAlerts() {
    const since = new Date(Date.now() - WEEK_MS);
    const newProperties = (await this.prisma.properties.findMany({
      where: {
        status: 'published',
        approval_status: 'approved',
        created_at: { gte: since },
        zone_id: { not: null },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        currency: true,
        operation: true,
        owner_id: true,
        zones: { select: { city: true, name: true } },
        property_images: { where: { is_main: true }, take: 1, select: { url: true } },
      },
      orderBy: { created_at: 'desc' },
    })) as unknown as NewProperty[];

    if (newProperties.length === 0) {
      this.logger.log('Sin propiedades nuevas esta semana, no se manda nada');
      return;
    }

    const byCity = new Map<string, NewProperty[]>();
    for (const p of newProperties) {
      const city = p.zones?.city?.trim();
      if (!city) continue;
      const key = city.toLowerCase();
      if (!byCity.has(key)) byCity.set(key, []);
      byCity.get(key)!.push(p);
    }

    let sent = 0;
    for (const props of byCity.values()) {
      const city = props[0].zones!.city;
      const users = await this.prisma.users.findMany({
        where: { status: 'active', city: { equals: city, mode: 'insensitive' } },
        select: { id: true, email: true, name: true },
      });

      for (const user of users) {
        const relevant = props.filter((p) => p.owner_id !== user.id).slice(0, MAX_PROPERTIES_PER_EMAIL);
        if (relevant.length === 0) continue;
        await this.email.sendWeeklyPropertyAlert(
          user.email,
          user.name,
          city,
          relevant.map((p) => ({
            title: p.title,
            slug: p.slug,
            price: Number(p.price),
            currency: p.currency,
            operation: p.operation,
            property_images: p.property_images,
          })),
        );
        sent++;
      }
    }

    this.logger.log(`Alertas semanales de propiedades enviadas: ${sent}`);
  }
}
