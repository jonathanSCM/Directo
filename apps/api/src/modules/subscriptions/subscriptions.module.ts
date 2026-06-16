import { Module } from '@nestjs/common';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  controllers: [
    PlansController,
    SubscriptionsController,
    AdminSubscriptionsController,
  ],
  providers: [PlansService, SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
