import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
