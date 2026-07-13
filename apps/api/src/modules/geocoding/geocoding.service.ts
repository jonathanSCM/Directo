import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
}

export interface ReverseGeocodeResult {
  formatted_address: string;
  zone_id: string | null;
  zone_name: string | null;
  city: string | null;
}

/** Geocodificación de direcciones vía Google Maps Geocoding API (§5). */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

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

  async reverseGeocode(
    lat: number,
    lng: number,
  ): Promise<ReverseGeocodeResult> {
    const nearestZone = await this.findNearestZone(lat, lng);

    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    let formatted_address = '';

    if (key) {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('latlng', `${lat},${lng}`);
      url.searchParams.set('language', 'es');
      url.searchParams.set('key', key);

      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data = (await res.json()) as {
          status: string;
          results?: Array<{
            formatted_address: string;
            types: string[];
          }>;
        };
        if (data.status === 'OK' && data.results?.length) {
          const isPlusCode = (addr: string) => /^\w{4}\+\w+/.test(addr);
          const best = data.results.find(
            (r) =>
              (r.types.includes('street_address') ||
                r.types.includes('route') ||
                r.types.includes('premise') ||
                r.types.includes('subpremise')) &&
              !isPlusCode(r.formatted_address),
          );
          formatted_address = best
            ? best.formatted_address
            : data.results.find((r) => !isPlusCode(r.formatted_address))
                ?.formatted_address ?? data.results[0].formatted_address;
        }
      } catch (err) {
        this.logger.error(`Reverse geocoding error: ${String(err)}`);
      }
    }

    return {
      formatted_address,
      zone_id: nearestZone?.id ?? null,
      zone_name: nearestZone?.name ?? null,
      city: nearestZone?.city ?? null,
    };
  }

  private async findNearestZone(lat: number, lng: number) {
    const zones = await this.prisma.zones.findMany({
      where: { is_active: true },
      select: { id: true, name: true, city: true, latitude: true, longitude: true },
    });

    let best: (typeof zones)[number] | null = null;
    let bestDist = Infinity;

    for (const z of zones) {
      if (z.latitude == null || z.longitude == null) continue;
      const dlat = Number(z.latitude) - lat;
      const dlng = Number(z.longitude) - lng;
      const dist = dlat * dlat + dlng * dlng;
      if (dist < bestDist) {
        bestDist = dist;
        best = z;
      }
    }

    return best;
  }
}
