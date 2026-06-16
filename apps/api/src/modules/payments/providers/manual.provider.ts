import { Injectable } from '@nestjs/common';
import {
  ChargeResult,
  CreateChargeInput,
  PaymentProvider,
} from './payment-provider.interface';

/**
 * Proveedor manual: QR / transferencia con comprobante.
 * El usuario paga y sube el comprobante; el administrador confirma (§12).
 * En producción, aquí se generaría el QR Simple (EMV) con los datos del
 * banco/PSP en lugar del payload de ejemplo.
 */
@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = 'manual';

  supports(method: string): boolean {
    return method === 'qr';
  }

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
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
