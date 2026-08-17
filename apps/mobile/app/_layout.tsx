import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { AuthProvider } from '../src/context/AuthContext';

// Tiene que correr apenas se carga el módulo (no en un useEffect): el popup
// de login con Google puede aterrizar en cualquier ruta, y los efectos de
// las pantallas hijas (p. ej. la redirección a onboarding si no hay sesión)
// corren ANTES que los del layout raíz — si esto fuera un efecto, llegaría
// tarde, la URL ya habría cambiado, y el popup se quedaría pegado.
if (Platform.OS === 'web') {
  WebBrowser.maybeCompleteAuthSession();
}
import { FavoritesProvider } from '../src/context/FavoritesContext';
import { NotificationProvider } from '../src/context/NotificationContext';
import { SubscriptionProvider } from '../src/context/SubscriptionContext';
import OwnerSupportFAB from '../src/components/support/OwnerSupportChat';

function useWebStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      html, body, #root { height: 100%; margin: 0; padding: 0; }
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
}

export default function RootLayout() {
  useWebStyles();
  return (
    <AuthProvider>
      <FavoritesProvider>
        <NotificationProvider>
        <SubscriptionProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="property/[id]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="edit-profile"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="create-property"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="edit-property"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="subscription"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="notifications"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="terms"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="reset-password"
            options={{ headerShown: false }}
          />
        </Stack>
        <OwnerSupportFAB />
        </SubscriptionProvider>
        </NotificationProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}
