import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdsService } from './ads.service';

/**
 * Antes, un anuncio vencido (`ends_at` pasado) simplemente dejaba de
 * mostrarse en `/ads/serve`, pero se quedaba como `active` para siempre en
 * el admin. Este cron lo pasa a `paused` de verdad, para que el estado que
 * ve el admin refleje la realidad.
 */
@Injectable()
export class AdsExpiryCron {
  private readonly logger = new Logger(AdsExpiryCron.name);

  constructor(private readonly adsService: AdsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleExpirations() {
    const result = await this.adsService.pauseExpired();
    if (result.count > 0) {
      this.logger.log(`${result.count} anuncio(s) vencido(s) pasado(s) a paused`);
    }
  }
}
