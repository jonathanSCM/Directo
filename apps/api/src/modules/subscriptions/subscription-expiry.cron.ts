import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Antes, una suscripción vencida solo se detectaba (y marcaba `expired`) la
 * próxima vez que alguien la consultaba — y nunca ocultaba las propiedades
 * ya publicadas. Este cron corre todos los días y hace las dos cosas:
 * expira las suscripciones vencidas y pausa las propiedades publicadas del
 * dueño (quedan `approval_status: approved`, así que al renovar no necesitan
 * pasar de nuevo por moderación).
 */
@Injectable()
export class SubscriptionExpiryCron {
  private readonly logger = new Logger(SubscriptionExpiryCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleExpirations() {
    const expired = await this.prisma.subscriptions.findMany({
      where: { status: 'active', end_date: { lt: new Date() } },
    });

    for (const sub of expired) {
      await this.prisma.subscriptions.update({
        where: { id: sub.id },
        data: { status: 'expired' },
      });

      const paused = await this.prisma.properties.updateMany({
        where: { owner_id: sub.user_id, status: 'published' },
        data: { status: 'paused' },
      });

      await this.prisma.notifications.create({
        data: {
          user_id: sub.user_id,
          type: 'subscription_expired',
          title: 'Suscripción vencida',
          message:
            paused.count > 0
              ? 'Tu suscripción venció y tus propiedades publicadas quedaron en pausa. Renueva tu plan para que vuelvan a mostrarse.'
              : 'Tu suscripción venció. Compra un plan para seguir publicando.',
          channel: 'in_app',
          status: 'pending',
          data: { subscription_id: sub.id },
        },
      });

      this.logger.log(
        `Suscripción ${sub.id} expirada, ${paused.count} propiedad(es) pausada(s)`,
      );
    }
  }
}
