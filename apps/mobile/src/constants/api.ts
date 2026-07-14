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

export const getImageUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${SERVER_BASE_URL}${path}`;
};
