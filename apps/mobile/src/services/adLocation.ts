import * as Location from 'expo-location';

/**
 * Coordenadas del cliente para segmentar publicidad por zona — solo si el
 * permiso de ubicación ya fue concedido antes (ej. al usar el mapa). Nunca
 * dispara el prompt de permiso desde acá: pedirlo solo para publicidad
 * sería invasivo.
 */
export async function getSilentCoords(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync();
    const loc = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    if (!loc) return null;
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    return null;
  }
}
