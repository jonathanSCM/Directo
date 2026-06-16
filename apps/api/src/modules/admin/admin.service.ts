import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminLogsQueryDto } from './dto/admin-logs-query.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Dashboard ───────────────────────────────────────────────────────────────

  async dashboard() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersLast30,
      activeUsers,
      suspendedUsers,
      pendingVerification,
      totalProperties,
      publishedProperties,
      pendingApprovalProperties,
      draftProperties,
      activeSubscriptions,
      totalRevenue,
      revenueLast30,
      pendingPayments,
      recentActivity,
    ] = await this.prisma.$transaction([
      this.prisma.users.count(),
      this.prisma.users.count({
        where: { created_at: { gte: thirtyDaysAgo } },
      }),
      this.prisma.users.count({ where: { status: 'active' } }),
      this.prisma.users.count({ where: { status: 'suspended' } }),
      this.prisma.users.count({ where: { status: 'pending_verification' } }),
      this.prisma.properties.count(),
      this.prisma.properties.count({ where: { status: 'published' } }),
      this.prisma.properties.count({ where: { status: 'pending_approval' } }),
      this.prisma.properties.count({ where: { status: 'draft' } }),
      this.prisma.subscriptions.count({ where: { status: 'active' } }),
      this.prisma.payments.aggregate({
        where: { status: 'confirmed' },
        _sum: { amount: true },
      }),
      this.prisma.payments.aggregate({
        where: {
          status: 'confirmed',
          paid_at: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
      }),
      this.prisma.payments.count({
        where: { status: { in: ['pending', 'in_review'] } },
      }),
      this.prisma.admin_logs.findMany({
        orderBy: { created_at: 'desc' },
        take: 10,
        include: {
          users: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        newLast30Days: newUsersLast30,
        byStatus: {
          active: activeUsers,
          suspended: suspendedUsers,
          pending_verification: pendingVerification,
        },
      },
      properties: {
        total: totalProperties,
        byStatus: {
          published: publishedProperties,
          pending_approval: pendingApprovalProperties,
          draft: draftProperties,
        },
      },
      subscriptions: {
        active: activeSubscriptions,
      },
      payments: {
        totalRevenue: totalRevenue._sum.amount ?? 0,
        revenueLast30Days: revenueLast30._sum.amount ?? 0,
        pending: pendingPayments,
      },
      recentActivity,
    };
  }

  // ── User management ─────────────────────────────────────────────────────────

  async listUsers(query: AdminUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.usersWhereInput = {};

    if (query.status) {
      where.status = query.status as any;
    }
    if (query.active_role) {
      where.active_role = query.active_role as any;
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q } },
      ];
    }

    const orderBy: Prisma.usersOrderByWithRelationInput =
      query.sort === 'name'
        ? { name: 'asc' }
        : query.sort === 'oldest'
          ? { created_at: 'asc' }
          : { created_at: 'desc' };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.users.count({ where }),
      this.prisma.users.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar_url: true,
          city: true,
          active_role: true,
          status: true,
          email_verified_at: true,
          last_login_at: true,
          created_at: true,
          _count: {
            select: {
              properties: true,
              subscriptions: true,
              payments: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar_url: true,
        city: true,
        active_role: true,
        status: true,
        email_verified_at: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
        user_roles: {
          include: { roles: { select: { name: true } } },
        },
        properties: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            approval_status: true,
            price: true,
            currency: true,
            operation: true,
            views_count: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
          take: 20,
        },
        subscriptions: {
          select: {
            id: true,
            status: true,
            start_date: true,
            end_date: true,
            created_at: true,
            subscription_plans: {
              select: { name: true, slug: true, price: true, currency: true },
            },
          },
          orderBy: { created_at: 'desc' },
          take: 5,
        },
        payments: {
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            status: true,
            paid_at: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async suspendUser(adminId: string, userId: string, reason?: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.status === 'suspended')
      throw new BadRequestException('El usuario ya está suspendido');

    const [updated] = await this.prisma.$transaction([
      this.prisma.users.update({
        where: { id: userId },
        data: { status: 'suspended' },
        select: { id: true, name: true, email: true, status: true },
      }),
      this.prisma.admin_logs.create({
        data: {
          admin_id: adminId,
          action: 'user_suspended',
          entity_type: 'user',
          entity_id: userId,
          metadata: reason ? { reason } : {},
        },
      }),
      this.prisma.notifications.create({
        data: {
          user_id: userId,
          type: 'system',
          title: 'Cuenta suspendida',
          message: reason
            ? `Tu cuenta ha sido suspendida. Motivo: ${reason}`
            : 'Tu cuenta ha sido suspendida. Contacta a soporte para más información.',
        },
      }),
    ]);

    return updated;
  }

  async activateUser(adminId: string, userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.status === 'active')
      throw new BadRequestException('El usuario ya está activo');

    const [updated] = await this.prisma.$transaction([
      this.prisma.users.update({
        where: { id: userId },
        data: { status: 'active' },
        select: { id: true, name: true, email: true, status: true },
      }),
      this.prisma.admin_logs.create({
        data: {
          admin_id: adminId,
          action: 'user_activated',
          entity_type: 'user',
          entity_id: userId,
        },
      }),
      this.prisma.notifications.create({
        data: {
          user_id: userId,
          type: 'system',
          title: 'Cuenta reactivada',
          message:
            'Tu cuenta ha sido reactivada. Ya puedes volver a utilizar la plataforma.',
        },
      }),
    ]);

    return updated;
  }

  // ── Audit logs ──────────────────────────────────────────────────────────────

  async listLogs(query: AdminLogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 30;

    const where: Prisma.admin_logsWhereInput = {};
    if (query.admin_id) where.admin_id = query.admin_id;
    if (query.entity_type) where.entity_type = query.entity_type;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.admin_logs.count({ where }),
      this.prisma.admin_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          users: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }
}
