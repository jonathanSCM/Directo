import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 86_400_000;
const ACTIVE_PROPERTY_STATUSES = ['published', 'pending_approval'] as const;

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Usuario ─────────────────────────────────────────────────────────────────

  async getMine(userId: string) {
    const active = await this.getActiveSubscription(userId);
    if (active) return active;
    return this.prisma.subscriptions.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: { subscription_plans: true },
    });
  }

  async activate(userId: string, planId: string) {
    const plan = await this.prisma.subscription_plans.findUnique({
      where: { id: planId },
    });
    if (!plan || !plan.is_active) {
      throw new BadRequestException('Plan inválido o inactivo');
    }
    const existing = await this.getActiveSubscription(userId);
    if (existing) {
      throw new ConflictException('Ya tienes una suscripción activa');
    }

    // Plan gratuito: se activa de inmediato. Plan de pago: queda pendiente de pago.
    if (Number(plan.price) === 0) {
      const start = new Date();
      const end = new Date(start.getTime() + plan.duration_days * DAY_MS);
      return this.prisma.subscriptions.create({
        data: {
          user_id: userId,
          plan_id: planId,
          status: 'active',
          start_date: start,
          end_date: end,
        },
        include: { subscription_plans: true },
      });
    }

    return this.prisma.subscriptions.create({
      data: { user_id: userId, plan_id: planId, status: 'pending_payment' },
      include: { subscription_plans: true },
    });
  }

  async renew(userId: string) {
    const sub = await this.prisma.subscriptions.findFirst({
      where: { user_id: userId, status: { in: ['active', 'expired'] } },
      orderBy: { created_at: 'desc' },
      include: { subscription_plans: true },
    });
    if (!sub) {
      throw new NotFoundException('No tienes una suscripción para renovar');
    }

    const plan = sub.subscription_plans;
    if (Number(plan.price) !== 0) {
      // Plan de pago: la renovación se confirma con el pago (§18).
      return this.prisma.subscriptions.update({
        where: { id: sub.id },
        data: { status: 'pending_payment' },
        include: { subscription_plans: true },
      });
    }

    const base =
      sub.end_date && sub.end_date > new Date() ? sub.end_date : new Date();
    return this.prisma.subscriptions.update({
      where: { id: sub.id },
      data: {
        status: 'active',
        start_date: sub.start_date ?? new Date(),
        end_date: new Date(base.getTime() + plan.duration_days * DAY_MS),
        renewed_at: new Date(),
      },
      include: { subscription_plans: true },
    });
  }

  async claimFreeTrial(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { free_trial_used: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.free_trial_used) {
      throw new BadRequestException(
        'Ya utilizaste tu periodo de prueba gratuito',
      );
    }
    const existing = await this.getActiveSubscription(userId);
    if (existing) {
      throw new ConflictException('Ya tienes una suscripción activa');
    }

    const start = new Date();
    const end = new Date(start.getTime() + 30 * DAY_MS);

    const [sub] = await this.prisma.$transaction([
      this.prisma.subscriptions.create({
        data: {
          user_id: userId,
          plan_id: await this.getOrCreateTrialPlanId(),
          status: 'active',
          start_date: start,
          end_date: end,
        },
        include: { subscription_plans: true },
      }),
      this.prisma.users.update({
        where: { id: userId },
        data: { free_trial_used: true },
      }),
    ]);

    return sub;
  }

  async hasUsedFreeTrial(userId: string): Promise<boolean> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { free_trial_used: true },
    });
    return user?.free_trial_used ?? false;
  }

  private async getOrCreateTrialPlanId(): Promise<string> {
    const existing = await this.prisma.subscription_plans.findUnique({
      where: { slug: 'trial-30' },
    });
    if (existing) return existing.id;
    const plan = await this.prisma.subscription_plans.create({
      data: {
        name: 'Prueba Gratuita 30 días',
        slug: 'trial-30',
        price: 0,
        currency: 'BOB',
        duration_days: 30,
        max_active_properties: 1,
        is_active: false,
      },
    });
    return plan.id;
  }

  // ── Admin (§13.4) ───────────────────────────────────────────────────────────

  async adminAssign(userId: string, planId: string) {
    const plan = await this.prisma.subscription_plans.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');

    const existing = await this.getActiveSubscription(userId);
    if (existing) {
      throw new ConflictException('El usuario ya tiene una suscripción activa');
    }

    const start = new Date();
    const end = new Date(start.getTime() + plan.duration_days * DAY_MS);

    const sub = await this.prisma.subscriptions.create({
      data: {
        user_id: userId,
        plan_id: planId,
        status: 'active',
        start_date: start,
        end_date: end,
      },
      include: { subscription_plans: true, users: { select: { id: true, name: true, email: true } } },
    });

    await this.notify(
      userId,
      'subscription_expiring',
      'Suscripción activada',
      `Se te ha asignado el plan "${plan.name}". Tu suscripción está activa.`,
      { subscription_id: sub.id },
    );

    return sub;
  }

  adminList(status?: string, userId?: string) {
    return this.prisma.subscriptions.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(userId ? { user_id: userId } : {}),
      },
      include: {
        subscription_plans: true,
        users: { select: { id: true, name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /** Activa una suscripción manualmente o tras confirmar un pago (§18). */
  async activateSubscription(subscriptionId: string) {
    const sub = await this.prisma.subscriptions.findUnique({
      where: { id: subscriptionId },
      include: { subscription_plans: true },
    });
    if (!sub) {
      throw new NotFoundException('Suscripción no encontrada');
    }
    const other = await this.prisma.subscriptions.findFirst({
      where: { user_id: sub.user_id, status: 'active', NOT: { id: sub.id } },
    });
    if (other) {
      throw new ConflictException('El usuario ya tiene una suscripción activa');
    }
    const start = new Date();
    const end = new Date(start.getTime() + sub.subscription_plans.duration_days * DAY_MS);
    const updated = await this.prisma.subscriptions.update({
      where: { id: subscriptionId },
      data: { status: 'active', start_date: start, end_date: end },
      include: { subscription_plans: true },
    });
    await this.notify(
      sub.user_id,
      'subscription_expiring',
      'Suscripción activada',
      'Tu suscripción está activa.',
      { subscription_id: sub.id },
    );
    return updated;
  }

  async cancel(subscriptionId: string) {
    const sub = await this.prisma.subscriptions.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub) {
      throw new NotFoundException('Suscripción no encontrada');
    }
    return this.prisma.subscriptions.update({
      where: { id: subscriptionId },
      data: { status: 'cancelled' },
      include: { subscription_plans: true },
    });
  }

  // ── Enforcement (§18) ───────────────────────────────────────────────────────

  /** Devuelve la suscripción activa (vence perezosamente si corresponde). */
  async getActiveSubscription(userId: string) {
    const sub = await this.prisma.subscriptions.findFirst({
      where: { user_id: userId, status: 'active' },
      include: { subscription_plans: true },
    });
    if (!sub) return null;
    if (sub.end_date && sub.end_date < new Date()) {
      await this.prisma.subscriptions.update({
        where: { id: sub.id },
        data: { status: 'expired' },
      });
      await this.notify(
        userId,
        'subscription_expired',
        'Suscripción vencida',
        'Tu suscripción ha vencido. Renuévala para seguir publicando.',
        { subscription_id: sub.id },
      );
      return null;
    }
    return sub;
  }

  /** Valida que el usuario pueda publicar según su suscripción y el plan (§18). */
  async assertCanPublish(userId: string, excludePropertyId?: string) {
    const enforce = await this.getBoolSetting(
      'subscriptions.require_for_publish',
      true,
    );
    if (!enforce) return;

    const sub = await this.getActiveSubscription(userId);
    if (!sub) {
      throw new ForbiddenException(
        'Necesitas una suscripción activa para publicar una propiedad',
      );
    }
    const max = sub.subscription_plans.max_active_properties;
    if (max != null) {
      const count = await this.prisma.properties.count({
        where: {
          owner_id: userId,
          status: { in: [...ACTIVE_PROPERTY_STATUSES] },
          ...(excludePropertyId ? { id: { not: excludePropertyId } } : {}),
        },
      });
      if (count >= max) {
        throw new ForbiddenException(
          `Tu plan permite ${max} propiedad(es) activa(s). Mejora tu plan para publicar más.`,
        );
      }
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async getBoolSetting(key: string, fallback: boolean) {
    const setting = await this.prisma.settings.findUnique({ where: { key } });
    if (!setting) return fallback;
    return setting.value === true;
  }

  private async notify(
    userId: string,
    type: 'subscription_expired' | 'subscription_expiring',
    title: string,
    message: string,
    data: Record<string, unknown>,
  ) {
    await this.prisma.notifications.create({
      data: {
        user_id: userId,
        type,
        title,
        message,
        channel: 'in_app',
        status: 'pending',
        data: data as never,
      },
    });
  }
}
