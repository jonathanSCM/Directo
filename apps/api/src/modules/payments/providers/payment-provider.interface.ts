/**
 * Abstracción de proveedor de pagos. Para integrar una pasarela real
 * (dLocal, Stripe, PayPal, banco con QR Simple, etc.) basta con implementar
 * esta interfaz y registrarla en el módulo — la lógica de negocio no cambia.
 */

export interface CreateChargeInput {
  paymentId: string;
  amount: number;
  currency: string;
  method: string;
  reference: string; // transaction_reference de nuestro pago
  description: string;
}

export interface ChargeResult {
  provider: string;
  /** Pasarelas con redirección (tarjeta / PayPal). */
  checkoutUrl?: string;
  /** Métodos QR. */
  qrPayload?: string;
  /** Texto para mostrar al usuario. */
  instructions?: string;
  /** Identificador del pago en el proveedor. */
  providerRef?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookResult {
  reference: string; // nuestro transaction_reference
  outcome: 'approved' | 'rejected';
  providerRef?: string;
  raw: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  supports(method: string): boolean;
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
  /** Valida y parsea el webhook entrante; devuelve null si no es válido. */
  parseWebhook(
    payload: Record<string, unknown>,
    headers: Record<string, unknown>,
  ): WebhookResult | null;
}
