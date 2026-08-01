import { GOOGLE_PLACES_API_KEY } from '../constants/api';
import api from '../services/api';
import { distanceKm } from './geo';

export interface PlaceOption {
  id: string;
  label: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  zoneId: string | null;
  placeId?: string;
}

// La API REST de Places bloquea llamadas directas desde el navegador (CORS):
// en web hay que usar el SDK de Google Maps JS, que carga como <script> y
// hace las llamadas por su cuenta (sin problema de CORS).
const SCZ_CENTER = { lat: -17.7833, lng: -63.1821 };
const SCZ_RADIUS_M = 25000;

let scriptPromise: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  const w = window as any;
  if (w.google?.maps?.places) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places&language=es`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Maps'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

let autocompleteService: any = null;
let placesService: any = null;
function getServices() {
  const google = (window as any).google;
  if (!autocompleteService) autocompleteService = new google.maps.places.AutocompleteService();
  if (!placesService) placesService = new google.maps.places.PlacesService(document.createElement('div'));
  return { autocompleteService, placesService };
}

async function searchZoneCatalog(text: string): Promise<PlaceOption[]> {
  try {
    const { data } = await api.get('/zones');
    return (data as any[])
      .filter((z) => `${z.name} ${z.city}`.toLowerCase().includes(text.toLowerCase()))
      .filter((z) => z.latitude != null && z.longitude != null)
      .map((z) => ({
        id: z.id,
        label: z.name,
        city: z.city,
        latitude: Number(z.latitude),
        longitude: Number(z.longitude),
        zoneId: z.id as string,
      }));
  } catch {
    return [];
  }
}

async function searchGooglePlaces(text: string): Promise<PlaceOption[]> {
  if (!GOOGLE_PLACES_API_KEY) return [];
  try {
    await loadGoogleMaps();
    const google = (window as any).google;
    const { autocompleteService } = getServices();
    return await new Promise((resolve) => {
      autocompleteService.getPlacePredictions(
        {
          input: text,
          locationBias: { center: SCZ_CENTER, radius: SCZ_RADIUS_M },
          componentRestrictions: { country: 'bo' },
          language: 'es',
        },
        (predictions: any[] | null, status: string) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
            resolve([]);
            return;
          }
          resolve(
            predictions.map((p) => ({
              id: `g-${p.place_id}`,
              label: p.structured_formatting?.main_text ?? p.description,
              city: 'Santa Cruz de la Sierra',
              latitude: null,
              longitude: null,
              zoneId: null,
              placeId: p.place_id,
            })),
          );
        },
      );
    });
  } catch {
    return [];
  }
}

export async function searchPlaces(
  text: string,
  origin: { latitude: number; longitude: number },
): Promise<PlaceOption[]> {
  const [zones, places] = await Promise.all([searchZoneCatalog(text), searchGooglePlaces(text)]);

  const seen = new Set<string>();
  const merged: PlaceOption[] = [];
  for (const p of [...zones, ...places]) {
    const key = p.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
  }

  const zonesSorted = merged
    .filter((p) => p.zoneId)
    .sort((a, b) => distanceKm(origin, { latitude: a.latitude!, longitude: a.longitude! }) - distanceKm(origin, { latitude: b.latitude!, longitude: b.longitude! }));
  const others = merged.filter((p) => !p.zoneId);

  return [...zonesSorted, ...others].slice(0, 6);
}

export async function resolvePlaceCoords(
  option: PlaceOption,
): Promise<{ latitude: number; longitude: number } | null> {
  if (option.latitude != null && option.longitude != null) {
    return { latitude: option.latitude, longitude: option.longitude };
  }
  if (!option.placeId) return null;
  try {
    await loadGoogleMaps();
    const google = (window as any).google;
    const { placesService } = getServices();
    return await new Promise((resolve) => {
      placesService.getDetails(
        { placeId: option.placeId, fields: ['geometry'] },
        (place: any, status: string) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
            resolve(null);
            return;
          }
          resolve({ latitude: place.geometry.location.lat(), longitude: place.geometry.location.lng() });
        },
      );
    });
  } catch {
    return null;
  }
}
