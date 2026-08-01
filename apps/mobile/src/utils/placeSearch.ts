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

// Centro + radio del área metropolitana de Santa Cruz de la Sierra — evita
// que Google resuelva un nombre a su homónimo lejano (p. ej. "Tarija" el
// departamento, en vez de "Calle Tarija" en Santa Cruz).
const SCZ_CENTER = { latitude: -17.7833, longitude: -63.1821 };
const SCZ_RADIUS_M = 25000;

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
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}` +
      `&key=${GOOGLE_PLACES_API_KEY}&language=es&components=country:bo` +
      `&location=${SCZ_CENTER.latitude},${SCZ_CENTER.longitude}&radius=${SCZ_RADIUS_M}&strictbounds=true`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return [];
    return (data.predictions as any[]).map((p) => ({
      id: `g-${p.place_id}`,
      label: p.structured_formatting?.main_text ?? p.description,
      city: 'Santa Cruz de la Sierra',
      latitude: null,
      longitude: null,
      zoneId: null,
      placeId: p.place_id,
    }));
  } catch {
    return [];
  }
}

/** Busca zonas (catálogo propio) + calles/lugares reales (Google Places, acotado a Santa Cruz). */
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

  // Las zonas del catálogo (con coordenada propia) se ordenan por cercanía
  // real; las de Google ya vienen sesgadas a Santa Cruz por location+radius.
  const zonesSorted = merged
    .filter((p) => p.zoneId)
    .sort((a, b) => distanceKm(origin, { latitude: a.latitude!, longitude: a.longitude! }) - distanceKm(origin, { latitude: b.latitude!, longitude: b.longitude! }));
  const others = merged.filter((p) => !p.zoneId);

  return [...zonesSorted, ...others].slice(0, 6);
}

/** Resuelve lat/lng de una sugerencia. Las de catálogo ya la traen; las de Google requieren un fetch a Place Details. */
export async function resolvePlaceCoords(
  option: PlaceOption,
): Promise<{ latitude: number; longitude: number } | null> {
  if (option.latitude != null && option.longitude != null) {
    return { latitude: option.latitude, longitude: option.longitude };
  }
  if (!option.placeId) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${option.placeId}&fields=geometry&key=${GOOGLE_PLACES_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return null;
    return { latitude: data.result.geometry.location.lat, longitude: data.result.geometry.location.lng };
  } catch {
    return null;
  }
}
