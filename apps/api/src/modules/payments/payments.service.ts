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
import { GatewayStubProvider } from './providers/gateway-stub.provider';
import { ManualPaymentProvider } from './providers/manual.provider';
import type { PaymentProvider } from './providers/payment-provider.interface';

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
    if (subscription.status !== 'pending_payment') {
      throw new BadRequestException(
        'La suscripción no está pendiente de pago',
      );
    }

    const method = dto.method;
    const provider = this.resolveProvider(method);
    const amount = Number(subscription.subscription_plans.price);
    const currency = subscription.subscription_plans.currency;
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

    await this.notify(
      payment.user_id,
      'payment_confirmed',
      'Pago confirmado',
      `Tu pago de ${payment.amount} ${payment.currency} fue confirmado.`,
      { payment_id: payment.id, subscription_id: payment.subscription_id },
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
      `Tu pago de ${payment.amount} ${payment.currency} fue rechazado.`,
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
