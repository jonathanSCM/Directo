import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BroadcastDto } from './dto/broadcast.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Usuario ─────────────────────────────────────────────────────────────────

  async list(userId: string, page = 1, limit = 20, unreadOnly = false) {
    const where: Prisma.notificationsWhereInput = {
      user_id: userId,
      ...(unreadOnly ? { read_at: null } : {}),
    };
    const [total, unreadCount, data] = await this.prisma.$transaction([
      this.prisma.notifications.count({ where }),
      this.prisma.notifications.count({
        where: { user_id: userId, read_at: null },
      }),
      this.prisma.notifications.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
      unreadCount,
    };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notifications.count({
      where: { user_id: userId, read_at: null },
    });
    return { count };
  }

  async markRead(userId: string, id: string) {
    const notif = await this.prisma.notifications.findUnique({ where: { id } });
    if (!notif || notif.user_id !== userId) {
      throw new NotFoundException('Notificación no encontrada');
    }
    if (notif.read_at) {
      return notif;
    }
    return this.prisma.notifications.update({
      where: { id },
      data: { read_at: new Date(), status: 'read' },
    });
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notifications.updateMany({
      where: { user_id: userId, read_at: null },
      data: { read_at: new Date(), status: 'read' },
    });
    return { updated: res.count };
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  /** Envío masivo (publicidad / anuncios) — §14. */
  async broadcast(dto: BroadcastDto) {
    const userIds = await this.resolveAudience(dto);
    if (userIds.length === 0) {
      return { sent: 0 };
    }
    const data: Prisma.notificationsCreateManyInput[] = userIds.map((uid) => ({
      user_id: uid,
      type: dto.type ?? 'promotion',
      title: dto.title,
      message: dto.message,
      channel: 'in_app',
      status: 'pending',
      data: (dto.url ? { url: dto.url } : {}) as Prisma.InputJsonValue,
    }));
    const res = await this.prisma.notifications.createMany({ data });
    return {
      sent: res.count,
      audience: dto.user_ids?.length ? 'custom' : (dto.audience ?? 'all'),
    };
  }

  /** Recordatorio "suscripción próxima a vencer" (§14). Idempotente por suscripción. */
  async sendExpiringReminders(days = 5) {
    const now = new Date();
    const until = new Date(now.getTime() + days * 86_400_000);
    const subs = await this.prisma.subscriptions.findMany({
      where: { status: 'active', end_date: { gte: now, lte: until } },
      include: { subscription_plans: true },
    });

    let sent = 0;
    for (const sub of subs) {
      const exists = await this.prisma.notifications.findFirst({
        where: {
          user_id: sub.user_id,
          type: 'subscription_expiring',
          read_at: null,
          data: { path: ['subscription_id'], equals: sub.id },
        },
      });
      if (exists) continue;

      await this.prisma.notifications.create({
        data: {
          user_id: sub.user_id,
          type: 'subscription_expiring',
          title: 'Tu suscripción está por vencer',
          message: `Tu plan ${sub.subscription_plans.name} vence el ${sub.end_date
            ?.toISOString()
            .slice(0, 10)}. Renuévalo para no perder tus publicaciones.`,
          channel: 'in_app',
          status: 'pending',
          data: { subscription_id: sub.id } as Prisma.InputJsonValue,
        },
      });
      sent++;
    }
    return { sent };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async resolveAudience(dto: BroadcastDto): Promise<string[]> {
    if (dto.user_ids?.length) {
      return dto.user_ids;
    }
    if ((dto.audience ?? 'all') === 'owners') {
      const rows = await this.prisma.properties.findMany({
        distinct: ['owner_id'],
        select: { owner_id: true },
      });
      return rows.map((r) => r.owner_id);
    }
    const rows = await this.prisma.users.findMany({
      where: { status: 'active' },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
