import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// WebBrowser.maybeCompleteAuthSession() corre en app/_layout.tsx (a nivel
// de módulo, no acá) — tiene que ejecutarse sin importar en qué ruta
// aterrice el popup de Google, no solo cuando se carga esta pantalla.

// Client ID "Web" (verifica el token en el backend) y "Android" (pide el
// login nativo desde la app) — ambos del mismo proyecto de Google Cloud,
// registrados para com.directo.app.
const WEB_CLIENT_ID = '950008513955-9o3vec1ts7t45v68pfga25nr4hs3us09.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = '950008513955-v602v6nfl6bduo6mhjgee9d6neuf3big.apps.googleusercontent.com';

// Sin `path`, en web da solo el origen (https://directoapp.net) — así el
// "Authorized redirect URI" que hay que registrar en Google Cloud es
// simple y predecible, en vez del sufijo /expo-auth-session por defecto.
// En Android/iOS NO se fuerza: el cliente nativo de Google solo acepta su
// redirect por defecto (esquema "reversed client id"), y `directo://` da 400.
const redirectUri =
  Platform.OS === 'web' ? AuthSession.makeRedirectUri({ path: '', scheme: 'directo' }) : undefined;

/** Pide el idToken de Google y lo entrega vía onIdToken; el caller lo manda a /auth/google. */
export function useGoogleSignIn(onIdToken: (idToken: string) => void) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    redirectUri,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token;
      if (idToken) onIdToken(idToken);
    }
  }, [response, onIdToken]);

  return { request, promptAsync };
}
