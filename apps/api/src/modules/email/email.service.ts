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

  private get webUrl(): string {
    return this.config.get<string>('WEB_APP_URL') ?? 'https://directoapp.net';
  }

  private get apiUrl(): string {
    return this.config.get<string>('API_PUBLIC_URL') ?? 'https://api.directoapp.net';
  }

  private resolveImageUrl(url?: string | null): string | null {
    if (!url) return null;
    return url.startsWith('http') ? url : `${this.apiUrl}${url}`;
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

  async sendWeeklyPropertyAlert(
    to: string,
    name: string,
    city: string,
    properties: {
      title: string;
      slug: string;
      price: number;
      currency: string;
      operation: string;
      property_images: { url: string }[];
    }[],
  ) {
    const opLabel = (op: string) => (op === 'sale' ? 'Venta' : op === 'rent' ? 'Alquiler' : 'Anticrético');
    const formatPrice = (p: number, c: string) => (c === 'USD' ? `$${p.toLocaleString()}` : `Bs. ${p.toLocaleString()}`);

    const cards = properties
      .map((p) => {
        const img = this.resolveImageUrl(p.property_images[0]?.url);
        const url = `${this.webUrl}/property/${p.slug}`;
        return `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #F3F4F6;">
              <a href="${url}" style="text-decoration: none; color: inherit; display: flex; gap: 14px; align-items: center;">
                ${img ? `<img src="${img}" width="90" height="72" style="border-radius: 10px; object-fit: cover; flex-shrink: 0;" />` : ''}
                <div>
                  <div style="font-size: 11px; font-weight: 700; color: #1D4ED8; text-transform: uppercase; letter-spacing: 0.5px;">${opLabel(p.operation)}</div>
                  <div style="font-weight: 700; color: #111827; margin: 2px 0;">${p.title}</div>
                  <div style="color: #6B7280; font-size: 14px;">${formatPrice(p.price, p.currency)}</div>
                </div>
              </a>
            </td>
          </tr>
        `;
      })
      .join('');

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1D4ED8;">Propiedades nuevas en ${city}</h2>
        <p>Hola ${name.split(' ')[0]}, esta semana se publicaron estas propiedades cerca tuyo:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          ${cards}
        </table>
        <p style="text-align: center; margin: 28px 0;">
          <a href="${this.webUrl}" style="background: #1D4ED8; color: #fff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700;">
            Ver todas en el mapa
          </a>
        </p>
        <p style="color: #9CA3AF; font-size: 12px;">Te llega este correo porque tenés una cuenta en DIRECTO con ciudad "${city}".</p>
      </div>
    `;
    await this.send(to, `${properties.length} propiedades nuevas en ${city}`, html);
  }
}
