import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GeocodeQueryDto } from './dto/geocode-query.dto';
import { ReverseGeocodeQueryDto } from './dto/reverse-geocode-query.dto';
import { GeocodingService } from './geocoding.service';

@ApiTags('geocoding')
@ApiBearerAuth()
@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Geocodificar una dirección a lat/long' })
  geocode(@Query() query: GeocodeQueryDto) {
    return this.geocodingService.geocode(query.address, query.city);
  }

  @Get('reverse')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reverse geocode: coordenadas a dirección + zona' })
  reverse(@Query() query: ReverseGeocodeQueryDto) {
    return this.geocodingService.reverseGeocode(query.lat, query.lng);
  }
}
