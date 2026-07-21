import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { QR_SETTINGS_KEY, QrSettings } from '../qr-settings.interface';
import {
  ChargeResult,
  CreateChargeInput,
  PaymentProvider,
} from './payment-provider.interface';

/**
 * Proveedor manual: QR / transferencia con comprobante.
 * El usuario paga y sube el comprobante; el administrador confirma (§12).
 *
 * Usa el QR bancario real que el admin configura en `settings` (key
 * QR_SETTINGS_KEY) — generado desde su app bancaria y subido como imagen.
 * Si todavía no lo configuró, cae a un payload de ejemplo para no romper
 * el flujo. Implementa PaymentProvider, así que puede reemplazarse por una
 * pasarela real (dLocal, Circle.bo, BCB QR Simple, etc.) sin tocar el resto
 * del sistema — solo registrar un nuevo provider en payments.module.ts.
 */
@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = 'manual';

  constructor(private readonly prisma: PrismaService) {}

  supports(method: string): boolean {
    return method === 'qr';
  }

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const row = await this.prisma.settings.findUnique({
      where: { key: QR_SETTINGS_KEY },
    });
    const cfg = (row?.value as QrSettings) ?? {};

    if (cfg.qrImageUrl) {
      const accountLine = [cfg.bankName, cfg.accountHolder, cfg.accountNumber]
        .filter(Boolean)
        .join(' · ');
      return {
        provider: this.name,
        qrImageUrl: cfg.qrImageUrl,
        bankName: cfg.bankName,
        accountHolder: cfg.accountHolder,
        accountNumber: cfg.accountNumber,
        instructions:
          cfg.instructions ||
          `Escanea el QR con tu app bancaria${accountLine ? ` (${accountLine})` : ''} y paga ${input.amount} ${input.currency} por: ${input.description}. Luego sube el comprobante para su validación.`,
        providerRef: input.reference,
      };
    }

    // El admin todavía no subió el QR bancario real: placeholder de ejemplo.
    return {
      provider: this.name,
      qrPayload: `INMOBILIARIA|${input.reference}|${input.amount}|${input.currency}`,
      instructions:
        'Escanea el QR o transfiere el monto indicado y luego sube el comprobante para su validación.',
      providerRef: input.reference,
    };
  }

  parseWebhook(): null {
    // Los pagos manuales se confirman desde el panel de administración.
    return null;
  }
}
