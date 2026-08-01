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

// Radio máximo (desde la ubicación del usuario) para aceptar un resultado de
// Google — no atado a ninguna ciudad, funciona para cualquier usuario en
// cualquier parte de Bolivia. locationBias del SDK es solo una sugerencia
// (no restringe de verdad), por eso la validación real es la distancia
// calculada acá una vez resuelta la coordenada exacta de cada candidato.
const MAX_RESULT_RADIUS_KM = 80;

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

function fetchPlaceDetailsCoords(placeId: string): Promise<{ latitude: number; longitude: number } | null> {
  const google = (window as any).google;
  const { placesService } = getServices();
  return new Promise((resolve) => {
    placesService.getDetails({ placeId, fields: ['geometry'] }, (place: any, status: string) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
        resolve(null);
        return;
      }
      resolve({ latitude: place.geometry.location.lat(), longitude: place.geometry.location.lng() });
    });
  });
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

async function searchGooglePlaces(
  text: string,
  origin: { latitude: number; longitude: number },
): Promise<PlaceOption[]> {
  if (!GOOGLE_PLACES_API_KEY) return [];
  try {
    await loadGoogleMaps();
    const google = (window as any).google;
    const { autocompleteService } = getServices();
    const predictions: any[] = await new Promise((resolve) => {
      autocompleteService.getPlacePredictions(
        {
          input: text,
          locationBias: { center: { lat: origin.latitude, lng: origin.longitude }, radius: MAX_RESULT_RADIUS_KM * 1000 },
          componentRestrictions: { country: 'bo' },
          language: 'es',
        },
        (results: any[] | null, status: string) => {
          resolve(status === google.maps.places.PlacesServiceStatus.OK && results ? results.slice(0, 5) : []);
        },
      );
    });

    const withCoords = await Promise.all(
      predictions.map(async (p) => ({ p, coords: await fetchPlaceDetailsCoords(p.place_id) })),
    );

    return withCoords
      .filter(({ coords }) => coords && distanceKm(origin, coords) <= MAX_RESULT_RADIUS_KM)
      .map(({ p, coords }) => ({
        id: `g-${p.place_id}`,
        label: p.structured_formatting?.main_text ?? p.description,
        city: p.structured_formatting?.secondary_text ?? '',
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        zoneId: null,
        placeId: p.place_id,
      }));
  } catch {
    return [];
  }
}

export async function searchPlaces(
  text: string,
  origin: { latitude: number; longitude: number },
): Promise<PlaceOption[]> {
  const [zones, places] = await Promise.all([searchZoneCatalog(text), searchGooglePlaces(text, origin)]);

  const seen = new Set<string>();
  const merged: PlaceOption[] = [];
  for (const p of [...zones, ...places]) {
    const key = p.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
  }

  return merged
    .sort((a, b) => distanceKm(origin, { latitude: a.latitude!, longitude: a.longitude! }) - distanceKm(origin, { latitude: b.latitude!, longitude: b.longitude! }))
    .slice(0, 6);
}

export async function resolvePlaceCoords(
  option: PlaceOption,
): Promise<{ latitude: number; longitude: number } | null> {
  if (option.latitude != null && option.longitude != null) {
    return { latitude: option.latitude, longitude: option.longitude };
  }
  if (!option.placeId) return null;
  await loadGoogleMaps();
  return fetchPlaceDetailsCoords(option.placeId);
}
