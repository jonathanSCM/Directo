import { GOOGLE_PLACES_API_KEY } from '../constants/api';
import api from '../services/api';
import { distanceKm } from './geo';

export interface PlaceOption {
  id: string;
  label: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  /** Si viene del catálogo de zonas, se puede filtrar /properties?zone_id=. Los resultados de Google (calles, negocios) no tienen zona propia. */
  zoneId: string | null;
  placeId?: string;
}

// Radio máximo (desde la ubicación del usuario) para aceptar un resultado de
// Google: sin esto, un nombre puede resolver a su homónimo en otro
// departamento (p. ej. "Tarija" el departamento en vez de "Calle Tarija"
// cerca del usuario). No está atado a ninguna ciudad — funciona para
// cualquier usuario, en cualquier parte de Bolivia.
const MAX_RESULT_RADIUS_KM = 80;

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

async function fetchPlaceDetailsCoords(placeId: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_PLACES_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return null;
    return { latitude: data.result.geometry.location.lat, longitude: data.result.geometry.location.lng };
  } catch {
    return null;
  }
}

async function searchGooglePlaces(
  text: string,
  origin: { latitude: number; longitude: number },
): Promise<PlaceOption[]> {
  if (!GOOGLE_PLACES_API_KEY) return [];
  try {
    // location+radius+strictbounds ya sesga/restringe bastante, pero solo es
    // una primera pasada barata — la validación real es la distancia
    // calculada más abajo, una vez que sabemos la coordenada exacta.
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}` +
      `&key=${GOOGLE_PLACES_API_KEY}&language=es&components=country:bo` +
      `&location=${origin.latitude},${origin.longitude}&radius=${MAX_RESULT_RADIUS_KM * 1000}&strictbounds=true`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return [];

    const predictions = (data.predictions as any[]).slice(0, 5);
    const withCoords = await Promise.all(
      predictions.map(async (p) => {
        const coords = await fetchPlaceDetailsCoords(p.place_id);
        return { p, coords };
      }),
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

/** Busca zonas (catálogo propio) + calles/lugares reales (Google Places), combinados y ordenados por cercanía real al origen dado. */
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

/** Resuelve lat/lng de una sugerencia (ya vienen resueltas desde searchPlaces; esto es solo un fallback). */
export async function resolvePlaceCoords(
  option: PlaceOption,
): Promise<{ latitude: number; longitude: number } | null> {
  if (option.latitude != null && option.longitude != null) {
    return { latitude: option.latitude, longitude: option.longitude };
  }
  if (!option.placeId) return null;
  return fetchPlaceDetailsCoords(option.placeId);
}
