import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 86_400_000;
const ACTIVE_PROPERTY_STATUSES = ['published', 'pending_approval'] as const;

type PlanRow = {
  id: string;
  price: Prisma.Decimal;
  currency: string;
  duration_days: number;
  included_properties: number;
  extra_property_price: Prisma.Decimal;
  name: string;
  is_active: boolean;
};

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Precio ──────────────────────────────────────────────────────────────────

  /**
   * Precio total = precio base del plan + (propiedades por encima de las
   * incluidas) * precio por propiedad extra.
   */
  computePrice(plan: PlanRow, propertyCount: number) {
    const included = plan.included_properties;
    const extraCount = Math.max(0, propertyCount - included);
    const base = Number(plan.price);
    const extraEach = Number(plan.extra_property_price);
    return {
      base,
      included_properties: included,
      extra_count: extraCount,
      extra_each: extraEach,
      total: base + extraCount * extraEach,
      currency: plan.currency,
    };
  }

  /** Cotización pública para el selector de propiedades del cliente. */
  async quote(planId: string, propertyCount: number) {
    const plan = await this.prisma.subscription_plans.findUnique({
      where: { id: planId },
    });
    if (!plan || !plan.is_active) {
      throw new NotFoundException('Plan no encontrado');
    }
    this.assertValidCount(propertyCount);
    return this.computePrice(plan, propertyCount);
  }

  private assertValidCount(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new BadRequestException('Cantidad de propiedades inválida (1-100)');
    }
  }

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

  async activate(userId: string, planId: string, propertyCount?: number) {
    const plan = await this.prisma.subscription_plans.findUnique({
      where: { id: planId },
    });
    if (!plan || !plan.is_active) {
      throw new BadRequestException('Plan inválido o inactivo');
    }

    const isFree = Number(plan.price) === 0;
    // El plan gratis siempre es con sus propiedades incluidas (1); en los
    // pagos el usuario elige cuántas quiere.
    const count = isFree
      ? plan.included_properties
      : (propertyCount ?? plan.included_properties);
    this.assertValidCount(count);

    const existing = await this.getActiveSubscription(userId);
    if (existing) {
      throw new ConflictException('Ya tienes una suscripción activa');
    }

    if (isFree) {
      const user = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { free_trial_used: true },
      });
      if (!user) throw new NotFoundException('Usuario no encontrado');
      if (user.free_trial_used) {
        throw new ForbiddenException(
          'Ya usaste tu plan gratis. Elige un plan de pago para seguir publicando.',
        );
      }
      const start = new Date();
      const end = new Date(start.getTime() + plan.duration_days * DAY_MS);
      try {
        const [sub] = await this.prisma.$transaction([
          this.prisma.subscriptions.create({
            data: {
              user_id: userId,
              plan_id: planId,
              status: 'active',
              start_date: start,
              end_date: end,
              property_count: count,
            },
            include: { subscription_plans: true },
          }),
          this.prisma.users.update({
            where: { id: userId },
            data: { free_trial_used: true },
          }),
        ]);
        return sub;
      } catch (e) {
        this.rethrowUniqueAsConflict(e);
      }
    }

    try {
      return await this.prisma.subscriptions.create({
        data: {
          user_id: userId,
          plan_id: planId,
          status: 'pending_payment',
          property_count: count,
        },
        include: { subscription_plans: true },
      });
    } catch (e) {
      this.rethrowUniqueAsConflict(e);
    }
  }

  /**
   * Renovación:
   * - Plan gratis: nunca se renueva (un solo uso).
   * - Plan pago vencido: nueva suscripción pendiente de pago (compra normal).
   * - Plan pago aún activo: se crea una renovación en `in_review` vinculada,
   *   SIN tocar la suscripción activa — el acceso no se corta. Al confirmarse
   *   el pago se extiende desde el end_date real.
   */
  async renew(userId: string, propertyCount?: number) {
    const sub = await this.prisma.subscriptions.findFirst({
      where: { user_id: userId, status: { in: ['active', 'expired'] } },
      orderBy: { created_at: 'desc' },
      include: { subscription_plans: true },
    });
    if (!sub) {
      throw new NotFoundException('No tienes una suscripción para renovar');
    }

    const plan = sub.subscription_plans;
    if (Number(plan.price) === 0) {
      throw new ForbiddenException(
        'El plan gratis no se puede renovar. Elige un plan de pago para seguir publicando.',
      );
    }

    const count = propertyCount ?? sub.property_count ?? plan.included_properties;
    this.assertValidCount(count);

    // Evitar renovaciones pendientes duplicadas
    const pendingRenewal = await this.prisma.subscriptions.findFirst({
      where: {
        user_id: userId,
        status: { in: ['in_review', 'pending_payment'] },
      },
    });
    if (pendingRenewal) {
      throw new ConflictException(
        'Ya tienes una renovación pendiente de pago. Complétala o espera su confirmación.',
      );
    }

    const stillActive =
      sub.status === 'active' && sub.end_date && sub.end_date > new Date();

    try {
      return await this.prisma.subscriptions.create({
        data: {
          user_id: userId,
          plan_id: plan.id,
          // Renovación anticipada: in_review (no choca con la activa en el
          // índice único). Vencida: compra normal pendiente de pago.
          status: stillActive ? 'in_review' : 'pending_payment',
          property_count: count,
          renews_subscription_id: stillActive ? sub.id : null,
        },
        include: { subscription_plans: true },
      });
    } catch (e) {
      this.rethrowUniqueAsConflict(e);
    }
  }

  /**
   * Compatibilidad con clientes antiguos (POST /subscriptions/free-trial):
   * activa el plan gratis público. Mismas reglas de un solo uso.
   */
  async claimFreeTrial(userId: string) {
    const freePlan = await this.prisma.subscription_plans.findFirst({
      where: { price: 0, is_active: true },
      orderBy: { created_at: 'asc' },
    });
    if (!freePlan) {
      throw new NotFoundException('No hay un plan gratis disponible');
    }
    return this.activate(userId, freePlan.id);
  }

  async hasUsedFreeTrial(userId: string): Promise<boolean> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { free_trial_used: true },
    });
    return user?.free_trial_used ?? false;
  }

  // ── Admin (§13.4) ───────────────────────────────────────────────────────────

  async adminAssign(userId: string, planId: string, propertyCount?: number) {
    const plan = await this.prisma.subscription_plans.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');

    const count = propertyCount ?? plan.included_properties;
    this.assertValidCount(count);

    const existing = await this.getActiveSubscription(userId);
    if (existing) {
      throw new ConflictException('El usuario ya tiene una suscripción activa');
    }

    const start = new Date();
    const end = new Date(start.getTime() + plan.duration_days * DAY_MS);

    let sub;
    try {
      sub = await this.prisma.subscriptions.create({
        data: {
          user_id: userId,
          plan_id: planId,
          status: 'active',
          start_date: start,
          end_date: end,
          property_count: count,
        },
        include: {
          subscription_plans: true,
          users: { select: { id: true, name: true, email: true } },
        },
      });
    } catch (e) {
      this.rethrowUniqueAsConflict(e);
    }

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

  /**
   * Confirma una suscripción (admin o webhook de pago).
   * - Compra nueva (pending_payment sin vínculo): activa desde ahora.
   * - Renovación anticipada (in_review con renews_subscription_id): extiende
   *   la suscripción activa desde su end_date real — no se pierde ni un día.
   */
  async activateSubscription(subscriptionId: string) {
    const sub = await this.prisma.subscriptions.findUnique({
      where: { id: subscriptionId },
      include: { subscription_plans: true },
    });
    if (!sub) {
      throw new NotFoundException('Suscripción no encontrada');
    }
    if (!['pending_payment', 'in_review', 'expired'].includes(sub.status)) {
      throw new BadRequestException(
        `No se puede activar una suscripción en estado "${sub.status}"`,
      );
    }

    const durationMs = sub.subscription_plans.duration_days * DAY_MS;

    // ¿Es una renovación anticipada de una suscripción que sigue activa?
    if (sub.renews_subscription_id) {
      const current = await this.prisma.subscriptions.findUnique({
        where: { id: sub.renews_subscription_id },
      });
      if (
        current &&
        current.status === 'active' &&
        current.end_date &&
        current.end_date > new Date()
      ) {
        // Extender la suscripción vigente; la fila de renovación queda como
        // registro histórico en estado `renewed`.
        const [extended] = await this.prisma.$transaction([
          this.prisma.subscriptions.update({
            where: { id: current.id },
            data: {
              end_date: new Date(current.end_date.getTime() + durationMs),
              renewed_at: new Date(),
              property_count: sub.property_count ?? current.property_count,
            },
            include: { subscription_plans: true },
          }),
          this.prisma.subscriptions.update({
            where: { id: sub.id },
            data: {
              status: 'renewed',
              start_date: current.end_date,
              end_date: new Date(current.end_date.getTime() + durationMs),
            },
          }),
        ]);
        await this.notify(
          sub.user_id,
          'subscription_expiring',
          'Renovación confirmada',
          `Tu suscripción se extendió hasta el ${extended.end_date!.toLocaleDateString('es-BO')}.`,
          { subscription_id: extended.id },
        );
        return extended;
      }
      // La original ya venció mientras se confirmaba: activar la renovación
      // como una suscripción nueva desde ahora (cae al flujo de abajo).
    }

    const other = await this.prisma.subscriptions.findFirst({
      where: { user_id: sub.user_id, status: 'active', NOT: { id: sub.id } },
    });
    if (other) {
      throw new ConflictException('El usuario ya tiene una suscripción activa');
    }
    const start = new Date();
    const end = new Date(start.getTime() + durationMs);
    let updated;
    try {
      updated = await this.prisma.subscriptions.update({
        where: { id: subscriptionId },
        data: { status: 'active', start_date: start, end_date: end },
        include: { subscription_plans: true },
      });
    } catch (e) {
      this.rethrowUniqueAsConflict(e);
    }
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
        'Tu suscripción ha vencido. Compra un plan para seguir publicando.',
        { subscription_id: sub.id },
      );
      return null;
    }
    return sub;
  }

  /** Valida que el usuario pueda publicar según su suscripción (§18). */
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
    // Tope = propiedades compradas por el usuario (fallback: incluidas del plan)
    const max =
      sub.property_count ?? sub.subscription_plans.included_properties;
    const count = await this.prisma.properties.count({
      where: {
        owner_id: userId,
        status: { in: [...ACTIVE_PROPERTY_STATUSES] },
        ...(excludePropertyId ? { id: { not: excludePropertyId } } : {}),
      },
    });
    if (count >= max) {
      throw new ForbiddenException(
        `Tu suscripción permite ${max} propiedad(es) activa(s). Amplía tu plan para publicar más.`,
      );
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** El índice único parcial de BD es la última línea de defensa contra carreras. */
  private rethrowUniqueAsConflict(e: unknown): never {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw new ConflictException('Ya tienes una suscripción vigente');
    }
    throw e;
  }

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
