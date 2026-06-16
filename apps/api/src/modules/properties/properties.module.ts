import { Module } from '@nestjs/common';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminPropertiesController } from './admin-properties.controller';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PropertyImagesController } from './property-images.controller';
import { PropertyImagesService } from './property-images.service';

@Module({
  imports: [GeocodingModule, SubscriptionsModule],
  controllers: [
    PropertiesController,
    AdminPropertiesController,
    PropertyImagesController,
  ],
  providers: [PropertiesService, PropertyImagesService],
})
export class PropertiesModule {}
