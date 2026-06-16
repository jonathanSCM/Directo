import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { PaymentsService } from './payments.service';
import { GatewayStubProvider } from './providers/gateway-stub.provider';
import { ManualPaymentProvider } from './providers/manual.provider';

@Module({
  imports: [SubscriptionsModule],
  controllers: [
    PaymentsController,
    AdminPaymentsController,
    PaymentsWebhookController,
  ],
  providers: [PaymentsService, ManualPaymentProvider, GatewayStubProvider],
})
export class PaymentsModule {}
