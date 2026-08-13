import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../push/push.service';

const DAY_MS = 86_400_000;

/**
 * Notificaciones promocionales de suscripción, in-app (no push del SO):
 * corre cada 2 horas y le manda un empujón a dos grupos —
 *   - "no_subscription": propietarios sin ninguna suscripción activa.
 *   - "free_plan_upgrade": propietarios con el plan gratis activo, con los
 *     días que le quedan (retención + upsell antes de que venza).
 *
 * No se re-manda mientras la última promo de ese mismo "kind" siga sin leer
 * — así el chequeo es cada 2h (más reactivo: si alguien recién se quedó sin
 * suscripción lo nota pronto) sin apilarle notificaciones repetidas a quien
 * todavía no abrió/leyó la anterior.
 */
@Injectable()
export class SubscriptionPromoCron {
  private readonly logger = new Logger(SubscriptionPromoCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  @Cron(CronExpression.EVERY_2_HOURS)
  async handlePromos() {
    const [noSub, freeActive] = await Promise.all([
      this.notifyNoSubscription(),
      this.notifyFreePlanUpgrade(),
    ]);
    this.logger.log(`Promos enviadas: ${noSub} sin suscripción, ${freeActive} mejorar plan gratis`);
  }

  private async hasUnreadPromo(userId: string, kind: string) {
    const existing = await this.prisma.notifications.findFirst({
      where: {
        user_id: userId,
        type: 'promotion',
        read_at: null,
        data: { path: ['kind'], equals: kind },
      },
      select: { id: true },
    });
    return !!existing;
  }

  private async notifyNoSubscription(): Promise<number> {
    const freePlan = await this.prisma.subscription_plans.findFirst({
      where: { price: 0, is_active: true },
    });

    const owners = await this.prisma.users.findMany({
      where: {
        status: 'active',
        user_roles: { some: { roles: { name: 'owner' } } },
        subscriptions: { none: { status: 'active' } },
      },
      select: { id: true },
    });

    const title = freePlan ? '¡Publicá gratis en DIRECTO!' : 'Publicá tu propiedad en DIRECTO';
    const message = freePlan
      ? `Activá el plan ${freePlan.name} (${freePlan.duration_days} días, sin tarjeta) y empezá a vender o alquilar hoy.`
      : 'Elegí un plan y empezá a vender o alquilar hoy mismo.';
    const data = { kind: 'no_subscription', url: '/subscription' };

    let sent = 0;
    for (const owner of owners) {
      if (await this.hasUnreadPromo(owner.id, 'no_subscription')) continue;
      await this.prisma.notifications.create({
        data: { user_id: owner.id, type: 'promotion', title, message, channel: 'in_app', status: 'pending', data },
      });
      await this.push.sendToUser(owner.id, title, message, data);
      sent++;
    }
    return sent;
  }

  private async notifyFreePlanUpgrade(): Promise<number> {
    const activeFreeSubs = await this.prisma.subscriptions.findMany({
      where: { status: 'active', subscription_plans: { price: 0 } },
      select: { id: true, user_id: true, end_date: true },
    });

    let sent = 0;
    for (const sub of activeFreeSubs) {
      if (await this.hasUnreadPromo(sub.user_id, 'free_plan_upgrade')) continue;
      const daysLeft = sub.end_date
        ? Math.max(0, Math.ceil((sub.end_date.getTime() - Date.now()) / DAY_MS))
        : null;
      const title =
        daysLeft != null
          ? `Te quedan ${daysLeft} día${daysLeft === 1 ? '' : 's'} de tu plan gratis`
          : 'Estás en el plan gratis';
      const message = 'Mejorá tu plan para más beneficios y no perder visibilidad cuando venza.';
      const data = { kind: 'free_plan_upgrade', subscription_id: sub.id, url: '/subscription' };

      await this.prisma.notifications.create({
        data: { user_id: sub.user_id, type: 'promotion', title, message, channel: 'in_app', status: 'pending', data },
      });
      await this.push.sendToUser(sub.user_id, title, message, data);
      sent++;
    }
    return sent;
  }
}
