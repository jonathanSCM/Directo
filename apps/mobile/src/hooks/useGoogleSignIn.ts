import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

WebBrowser.maybeCompleteAuthSession();

// Client ID "Web" (verifica el token en el backend) y "Android" (pide el
// login nativo desde la app) — ambos del mismo proyecto de Google Cloud,
// registrados para com.directo.app.
const WEB_CLIENT_ID = '535252091576-o3rq2luttqlq02mobuf0n4m2nmstu9lg.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = '535252091576-l82s63j17nbr33l5v920vjg440ribj2r.apps.googleusercontent.com';

// Sin `path`, en web da solo el origen (https://directoapp.net) — así el
// "Authorized redirect URI" que hay que registrar en Google Cloud es
// simple y predecible, en vez del sufijo /expo-auth-session por defecto.
const redirectUri = AuthSession.makeRedirectUri({ path: '', scheme: 'directo' });

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
