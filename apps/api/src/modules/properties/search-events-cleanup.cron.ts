import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

const RETENTION_DAYS = 90;

/**
 * `search_events` se llena en cada búsqueda pública (ver
 * `PropertiesService.logSearchEvent`) — sin límite, crecería sin parar. Este
 * cron borra lo más viejo que 90 días; para analítica de demanda no hace
 * falta guardar más que eso.
 */
@Injectable()
export class SearchEventsCleanupCron {
  private readonly logger = new Logger(SearchEventsCleanupCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleCleanup() {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const res = await this.prisma.search_events.deleteMany({
      where: { created_at: { lt: cutoff } },
    });
    if (res.count > 0) {
      this.logger.log(`${res.count} evento(s) de búsqueda con más de ${RETENTION_DAYS} días eliminados`);
    }
  }
}
