import Constants from 'expo-constants';
import { Platform } from 'react-native';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;

const debuggerHost =
  Platform.OS === 'web'
    ? 'localhost'
    : (Constants.expoConfig?.hostUri?.split(':')[0] ?? '192.168.0.4');

export const SERVER_BASE_URL = envApiUrl
  ? envApiUrl.replace(/\/api$/, '')
  : `http://${debuggerHost}:3000`;
export const API_BASE_URL = envApiUrl || `${SERVER_BASE_URL}/api`;

export const getImageUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${SERVER_BASE_URL}${path}`;
};
