import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
}

/** Geocodificación de direcciones vía Google Maps Geocoding API (§5). */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return !!this.config.get<string>('GOOGLE_MAPS_API_KEY');
  }

  async geocode(address: string, city?: string): Promise<GeocodeResult | null> {
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!key) {
      this.logger.warn('GOOGLE_MAPS_API_KEY no configurada; se omite geocoding');
      return null;
    }

    const region = this.config.get<string>('GEOCODING_REGION') ?? 'bo';
    const query = city ? `${address}, ${city}` : address;

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query);
    url.searchParams.set('region', region);
    url.searchParams.set('key', key);

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = (await res.json()) as {
        status: string;
        results?: Array<{
          formatted_address: string;
          geometry: { location: { lat: number; lng: number } };
        }>;
      };

      if (data.status !== 'OK' || !data.results?.length) {
        this.logger.warn(
          `Geocoding sin resultados (${data.status}) para "${query}"`,
        );
        return null;
      }

      const best = data.results[0];
      return {
        latitude: best.geometry.location.lat,
        longitude: best.geometry.location.lng,
        formatted_address: best.formatted_address,
      };
    } catch (err) {
      this.logger.error(`Error en geocoding para "${query}": ${String(err)}`);
      return null;
    }
  }
}
