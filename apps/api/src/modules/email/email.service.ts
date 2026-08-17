import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Envío de emails transaccionales vía Resend. Sin RESEND_API_KEY configurada
 * (dev local, o antes de darla de alta en Coolify), solo loguea y no falla —
 * el flujo que lo llama (ej. forgotPassword) sigue funcionando igual.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string | undefined {
    return this.config.get<string>('RESEND_API_KEY');
  }

  private get from(): string {
    return this.config.get<string>('RESEND_FROM_EMAIL') ?? 'DIRECTO <onboarding@resend.dev>';
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.apiKey) {
      this.logger.warn(`RESEND_API_KEY no configurada — no se envió el email "${subject}" a ${to}`);
      return;
    }
    try {
      const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to, subject, html }),
      });
      if (!res.ok) {
        this.logger.warn(`Resend respondió ${res.status}: ${await res.text()}`);
      }
    } catch (e) {
      this.logger.error('Error mandando email vía Resend', e as Error);
    }
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1D4ED8;">Recuperar contraseña</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña en DIRECTO.</p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background: #1D4ED8; color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700;">
            Restablecer contraseña
          </a>
        </p>
        <p style="color: #6B7280; font-size: 13px;">Este enlace vence en 1 hora. Si no pediste esto, podés ignorar el correo.</p>
      </div>
    `;
    await this.send(to, 'Recuperar tu contraseña — DIRECTO', html);
  }
}
