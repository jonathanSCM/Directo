import Constants from 'expo-constants';
import { Platform } from 'react-native';

const defaultApiUrl = 'https://api.directoapp.net/api';
const envApiUrl = process.env.EXPO_PUBLIC_API_URL || defaultApiUrl;

const debuggerHost =
  Platform.OS === 'web'
    ? 'localhost'
    : (Constants.expoConfig?.hostUri?.split(':')[0] ?? '192.168.0.4');

export const SERVER_BASE_URL = envApiUrl.replace(/\/api$/, '');
export const API_BASE_URL = envApiUrl;

// Dominio público donde vive la web (para links compartibles) — en dev
// local usa el mismo origen del browser, en producción/nativo cae al fijo.
export const PUBLIC_WEB_URL =
  Platform.OS === 'web' && typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.origin)
    ? window.location.origin
    : 'https://directoapp.net';

// Google Places (autocompletado de calles/lugares en el buscador del mapa).
// Sin default hardcodeado a propósito: se configura por variable de entorno
// en el deploy (EXPO_PUBLIC_GOOGLE_PLACES_API_KEY). Si falta, la búsqueda de
// calles simplemente no trae resultados de Google (el catálogo de zonas
// propio sigue funcionando igual).
export const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

export const getImageUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${SERVER_BASE_URL}${path}`;
};
