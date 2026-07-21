import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { UpdateQrSettingsDto } from './dto/update-qr-settings.dto';
import { GatewayStubProvider } from './providers/gateway-stub.provider';
import { ManualPaymentProvider } from './providers/manual.provider';
import type { PaymentProvider } from './providers/payment-provider.interface';
import { QR_SETTINGS_KEY, QrSettings } from './qr-settings.interface';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly providers: PaymentProvider[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly manual: ManualPaymentProvider,
    private readonly gateway: GatewayStubProvider,
  ) {
    this.providers = [manual, gateway];
  }

  private resolveProvider(method: string): PaymentProvider {
    const provider = this.providers.find((p) => p.supports(method));
    if (!provider) {
      throw new BadRequestException(
        `Método de pago '${method}' no soportado`,
      );
    }
    return provider;
  }

  // ── Usuario ─────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreatePaymentDto) {
    const subscription = await this.prisma.subscriptions.findUnique({
      where: { id: dto.subscription_id },
      include: { subscription_plans: true },
    });
    if (!subscription || subscription.user_id !== userId) {
      throw new NotFoundException('Suscripción no encontrada');
    }
    // pending_payment: compra nueva; in_review: renovación anticipada
    if (!['pending_payment', 'in_review'].includes(subscription.status)) {
      throw new BadRequestException(
        'La suscripción no está pendiente de pago',
      );
    }

    const method = dto.method;
    const provider = this.resolveProvider(method);
    // Total con propiedades extra incluidas
    const quote = this.subscriptions.computePrice(
      subscription.subscription_plans,
      subscription.property_count ??
        subscription.subscription_plans.included_properties,
    );
    const amount = quote.total;
    const currency = quote.currency;
    const reference = this.newReference();

    const payment = await this.prisma.payments.create({
      data: {
        user_id: userId,
        subscription_id: subscription.id,
        amount,
        currency,
        method: method as never,
        provider: provider.name,
        transaction_reference: reference,
        status: 'pending',
      },
    });

    const charge = await provider.createCharge({
      paymentId: payment.id,
      amount,
      currency,
      method,
      reference,
      description: `Suscripción ${subscription.subscription_plans.name}`,
    });

    const updated = await this.prisma.payments.update({
      where: { id: payment.id },
      data: { metadata: charge as unknown as Prisma.InputJsonValue },
    });

    return { payment: updated, checkout: charge };
  }

  /**
   * Cobro puntual por publicar una propiedad que excede el cupo del plan.
   * Reutiliza el mismo flujo QR + comprobante + aprobación admin que las
   * suscripciones, pero apuntando a la propiedad en vez de a la suscripción.
   */
  async createPropertyExtraCharge(userId: string, propertyId: string) {
    const property = await this.prisma.properties.findUnique({
      where: { id: propertyId },
    });
    if (!property || property.owner_id !== userId) {
      throw new NotFoundException('Propiedad no encontrada');
    }
    if (property.status !== 'paused' || property.approval_status !== 'approved') {
      throw new BadRequestException(
        'Esta propiedad no está en condición de pagarse como extra',
      );
    }
    const sub = await this.subscriptions.getActiveSubscription(userId);
    if (!sub) {
      throw new BadRequestException('Necesitas una suscripción activa');
    }
    const withinLimit = await this.subscriptions.isWithinPropertyLimit(
      userId,
      propertyId,
    );
    if (withinLimit) {
      throw new BadRequestException(
        'Esta propiedad no está bloqueada por el límite de tu plan',
      );
    }

    // Evita generar cobros duplicados si ya hay uno pendiente para la misma propiedad.
    const existing = await this.prisma.payments.findFirst({
      where: { property_id: propertyId, status: { in: ['pending', 'in_review'] } },
    });
    if (existing) {
      return { payment: existing, checkout: existing.metadata };
    }

    const amount = Number(sub.subscription_plans.extra_property_price);
    const currency = sub.subscription_plans.currency;
    const method = 'qr';
    const provider = this.resolveProvider(method);
    const reference = this.newReference();

    const payment = await this.prisma.payments.create({
      data: {
        user_id: userId,
        property_id: propertyId,
        amount,
        currency,
        method: method as never,
        provider: provider.name,
        transaction_reference: reference,
        status: 'pending',
      },
    });

    const charge = await provider.createCharge({
      paymentId: payment.id,
      amount,
      currency,
      method,
      reference,
      description: `Propiedad extra: ${property.title}`,
    });

    const updated = await this.prisma.payments.update({
      where: { id: payment.id },
      data: { metadata: charge as unknown as Prisma.InputJsonValue },
    });

    return { payment: updated, checkout: charge };
  }

  async getOwn(userId: string, paymentId: string) {
    return this.getOwnPayment(userId, paymentId);
  }

  async uploadProof(
    userId: string,
    paymentId: string,
    file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió el comprobante');
    }
    await this.getOwnPayment(userId, paymentId);
    return this.prisma.payments.update({
      where: { id: paymentId },
      data: { proof_url: `/uploads/${file.filename}`, status: 'in_review' },
    });
  }

  listMine(userId: string) {
    return this.prisma.payments.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  adminList(query: PaymentsQueryDto) {
    return this.prisma.payments.findMany({
      where: {
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.method ? { method: query.method as never } : {}),
        ...(query.user_id ? { user_id: query.user_id } : {}),
      },
      include: {
        users: { select: { id: true, name: true, email: true } },
        subscriptions: { include: { subscription_plans: true } },
        properties: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  confirm(paymentId: string) {
    return this.confirmPayment(paymentId);
  }

  reject(paymentId: string) {
    return this.rejectPayment(paymentId);
  }

  /**
   * Configuración del QR bancario mostrado a los usuarios (§ManualPaymentProvider).
   * Se guarda en la tabla genérica `settings`, no hace falta una tabla propia.
   */
  async getQrSettings(): Promise<QrSettings> {
    const row = await this.prisma.settings.findUnique({
      where: { key: QR_SETTINGS_KEY },
    });
    return (row?.value as QrSettings) ?? {};
  }

  async updateQrSettings(
    dto: UpdateQrSettingsDto,
    file?: Express.Multer.File,
  ): Promise<QrSettings> {
    const current = await this.getQrSettings();
    const next: QrSettings = {
      ...current,
      ...(dto.bank_name !== undefined ? { bankName: dto.bank_name } : {}),
      ...(dto.account_holder !== undefined
        ? { accountHolder: dto.account_holder }
        : {}),
      ...(dto.account_number !== undefined
        ? { accountNumber: dto.account_number }
        : {}),
      ...(dto.instructions !== undefined
        ? { instructions: dto.instructions }
        : {}),
      ...(file ? { qrImageUrl: `/uploads/${file.filename}` } : {}),
    };
    await this.prisma.settings.upsert({
      where: { key: QR_SETTINGS_KEY },
      create: {
        key: QR_SETTINGS_KEY,
        value: next as unknown as Prisma.InputJsonValue,
        description: 'QR bancario y datos de cuenta para pagos manuales',
      },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });
    return next;
  }

  // ── Lógica compartida ───────────────────────────────────────────────────────

  async confirmPayment(paymentId: string) {
    const payment = await this.prisma.payments.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.status === 'confirmed') return payment;

    const updated = await this.prisma.payments.update({
      where: { id: paymentId },
      data: { status: 'confirmed', paid_at: new Date() },
    });

    if (payment.subscription_id) {
      try {
        await this.subscriptions.activateSubscription(payment.subscription_id);
      } catch (err) {
        this.logger.warn(
          `Pago ${paymentId} confirmado pero no se activó la suscripción: ${String(err)}`,
        );
      }
    }

    let propertyPublished = false;
    if (payment.property_id) {
      try {
        const prop = await this.prisma.properties.findUnique({
          where: { id: payment.property_id },
        });
        // Solo publica si sigue pausada: si el dueño la dio de baja, la
        // vendió, o ya la publicó por otra vía mientras el pago estaba
        // pendiente, no hay que pisar ese estado más reciente.
        if (prop && prop.status === 'paused') {
          await this.prisma.properties.update({
            where: { id: prop.id },
            data: { status: 'published', published_at: prop.published_at ?? new Date() },
          });
          propertyPublished = true;
        }
      } catch (err) {
        this.logger.warn(
          `Pago ${paymentId} confirmado pero no se pudo publicar la propiedad: ${String(err)}`,
        );
      }
    }

    await this.notify(
      payment.user_id,
      'payment_confirmed',
      'Pago confirmado',
      propertyPublished
        ? `Tu pago de ${payment.amount} ${payment.currency} fue confirmado. Tu propiedad ya está publicada.`
        : `Tu pago de ${payment.amount} ${payment.currency} fue confirmado.`,
      { payment_id: payment.id, subscription_id: payment.subscription_id, property_id: payment.property_id },
    );
    return updated;
  }

  async rejectPayment(paymentId: string) {
    const payment = await this.prisma.payments.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.status === 'rejected') return payment;

    const updated = await this.prisma.payments.update({
      where: { id: paymentId },
      data: { status: 'rejected' },
    });
    await this.notify(
      payment.user_id,
      'payment_rejected',
      'Pago rechazado',
      payment.property_id
        ? `Tu comprobante para publicar la propiedad extra fue rechazado. Vuelve a intentar el pago.`
        : `Tu pago de ${payment.amount} ${payment.currency} fue rechazado.`,
      { payment_id: payment.id },
    );
    return updated;
  }

  // ── Webhook ─────────────────────────────────────────────────────────────────

  async handleWebhook(
    providerName: string,
    payload: Record<string, unknown>,
    headers: Record<string, unknown>,
  ) {
    const provider = this.providers.find((p) => p.name === providerName);
    if (!provider) {
      this.logger.warn(`Webhook de provider desconocido: ${providerName}`);
      return;
    }

    const result = provider.parseWebhook(payload, headers);
    if (!result) {
      this.logger.warn(`Webhook inválido de ${providerName}`);
      return;
    }

    const payment = await this.prisma.payments.findFirst({
      where: { transaction_reference: result.reference },
    });
    if (!payment) {
      this.logger.warn(`Pago no encontrado para ref=${result.reference}`);
      return;
    }

    if (result.outcome === 'approved') {
      await this.confirmPayment(payment.id);
    } else {
      await this.rejectPayment(payment.id);
    }

    this.logger.log(
      `Webhook ${providerName}: ref=${result.reference} outcome=${result.outcome}`,
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private newReference(): string {
    return `PAY-${Date.now().toString(36).toUpperCase()}-${randomUUID()
      .slice(0, 6)
      .toUpperCase()}`;
  }

  private async getOwnPayment(userId: string, paymentId: string) {
    const payment = await this.prisma.payments.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.user_id !== userId) {
      throw new ForbiddenException('Este pago no te pertenece');
    }
    return payment;
  }

  private async notify(
    userId: string,
    type: 'payment_confirmed' | 'payment_rejected',
    title: string,
    message: string,
    data: Record<string, unknown>,
  ) {
    await this.prisma.notifications.create({
      data: {
        user_id: userId,
        type,
        title,
        message,
        channel: 'in_app',
        status: 'pending',
        data: data as Prisma.InputJsonValue,
      },
    });
  }
}
