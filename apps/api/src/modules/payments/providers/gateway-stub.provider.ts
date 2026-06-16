import { Injectable, Logger } from '@nestjs/common';
import {
  ChargeResult,
  CreateChargeInput,
  PaymentProvider,
  WebhookResult,
} from './payment-provider.interface';

/**
 * Stub que simula una pasarela de tarjeta/PayPal.
 * Reemplazar con la implementación real (dLocal, Kushki, Stripe, etc.)
 * cuando se tenga contrato con el PSP.
 */
@Injectable()
export class GatewayStubProvider implements PaymentProvider {
  private readonly logger = new Logger(GatewayStubProvider.name);
  readonly name = 'gateway_stub';

  supports(method: string): boolean {
    return method === 'visa' || method === 'paypal';
  }

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const checkoutUrl = `https://sandbox.pasarela.example/checkout?ref=${input.reference}&amount=${input.amount}&currency=${input.currency}`;
    this.logger.log(
      `[STUB] Checkout creado: ${checkoutUrl} (method=${input.method})`,
    );
    return {
      provider: this.name,
      checkoutUrl,
      instructions: 'Serás redirigido a la pasarela de pago.',
      providerRef: `STUB-${input.reference}`,
    };
  }

  parseWebhook(
    payload: Record<string, unknown>,
    headers: Record<string, unknown>,
  ): WebhookResult | null {
    const secret = headers['x-webhook-secret'];
    if (!secret || secret !== process.env['PAYMENTS_WEBHOOK_SECRET']) {
      this.logger.warn('[STUB] Webhook con secret inválido');
      return null;
    }
    const ref = payload['reference'] as string | undefined;
    const status = payload['status'] as string | undefined;
    if (!ref || !status) return null;

    return {
      reference: ref,
      outcome: status === 'approved' ? 'approved' : 'rejected',
      providerRef: (payload['provider_ref'] as string) ?? undefined,
      raw: payload,
    };
  }
}
