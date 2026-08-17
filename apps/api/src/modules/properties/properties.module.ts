import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminPropertiesController } from './admin-properties.controller';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PropertyAlertsCron } from './property-alerts.cron';
import { PropertyImagesController } from './property-images.controller';
import { PropertyImagesService } from './property-images.service';

@Module({
  imports: [GeocodingModule, SubscriptionsModule, EmailModule],
  controllers: [
    PropertiesController,
    AdminPropertiesController,
    PropertyImagesController,
  ],
  providers: [PropertiesService, PropertyImagesService, PropertyAlertsCron],
})
export class PropertiesModule {}
