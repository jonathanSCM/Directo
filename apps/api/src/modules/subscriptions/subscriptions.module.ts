import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { SubscriptionExpiryCron } from './subscription-expiry.cron';
import { SubscriptionPromoCron } from './subscription-promo.cron';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [PushModule],
  controllers: [
    PlansController,
    SubscriptionsController,
    AdminSubscriptionsController,
  ],
  providers: [PlansService, SubscriptionsService, SubscriptionExpiryCron, SubscriptionPromoCron],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
