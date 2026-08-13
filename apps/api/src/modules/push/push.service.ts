import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// La API de Expo recomienda no mandar más de 100 mensajes por request.
const CHUNK_SIZE = 100;

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Envío de push notifications (Android/iOS) vía el servicio de Expo — no
 * habla directo con FCM/APNs, Expo hace ese puente. Requiere que el celular
 * haya registrado su token con `POST /users/me/push-token` (ver
 * UsersService.registerPushToken).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Manda la misma notificación a todos los tokens de un usuario (puede tener más de uno). */
  async sendToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
    const tokens = await this.prisma.push_tokens.findMany({
      where: { user_id: userId },
      select: { token: true },
    });
    if (tokens.length === 0) return;
    await this.sendBatch(tokens.map((t) => ({ to: t.token, title, body, data })));
  }

  async sendBatch(messages: PushMessage[]) {
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(chunk.map((m) => ({ ...m, sound: 'default' }))),
        });
        if (!res.ok) {
          this.logger.warn(`Expo push respondió ${res.status}: ${await res.text()}`);
          continue;
        }
        const json = await res.json();
        await this.cleanupInvalidTokens(json?.data ?? [], chunk);
      } catch (e) {
        this.logger.error('Error mandando push a Expo', e as Error);
      }
    }
  }

  /**
   * Expo devuelve un "receipt" por mensaje en el mismo orden que se mandaron;
   * si el error es DeviceNotRegistered, el token ya no sirve (app
   * desinstalada, etc.) — lo borramos para no seguir intentando.
   */
  private async cleanupInvalidTokens(
    results: { status: string; details?: { error?: string } }[],
    chunk: PushMessage[],
  ) {
    const deadTokens = results
      .map((r, i) => (r.status === 'error' && r.details?.error === 'DeviceNotRegistered' ? chunk[i]?.to : null))
      .filter((t): t is string => !!t);
    if (deadTokens.length > 0) {
      await this.prisma.push_tokens.deleteMany({ where: { token: { in: deadTokens } } });
      this.logger.log(`Eliminados ${deadTokens.length} token(s) de push inválidos`);
    }
  }
}
