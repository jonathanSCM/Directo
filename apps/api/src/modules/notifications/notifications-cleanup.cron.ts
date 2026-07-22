import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

const RETENTION_MS = 24 * 60 * 60 * 1000; // 1 día

/**
 * Las notificaciones in-app son informativas y de corta vida (pago
 * confirmado, suscripción por vencer, etc.) — no tiene sentido que se
 * acumulen indefinidamente en la bandeja del usuario. Este cron corre
 * varias veces al día y borra las que ya pasaron su día de vida, leídas
 * o no.
 */
@Injectable()
export class NotificationsCleanupCron {
  private readonly logger = new Logger(NotificationsCleanupCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async handleCleanup() {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    const res = await this.prisma.notifications.deleteMany({
      where: { created_at: { lt: cutoff } },
    });
    if (res.count > 0) {
      this.logger.log(`${res.count} notificación(es) con más de 1 día eliminadas`);
    }
  }
}
