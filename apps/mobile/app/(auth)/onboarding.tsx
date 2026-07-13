import { useRouter } from 'expo-router';
import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../../src/constants/theme';

const bgImage = require('../../assets/onboarding-bg.png');

export default function Onboarding() {
  const router = useRouter();

  return (
    <ImageBackground source={bgImage} style={styles.container} resizeMode="cover">
      <View style={styles.overlay} />

      <View style={styles.bottom}>
        <Text style={styles.tagline}>
          COMPRA {'·'} VENDE {'·'} SIN INTERMEDIARIOS
        </Text>
        <Text style={styles.headline}>
          Tu próximo hogar,{'\n'}en el mapa.
        </Text>
        <Text style={styles.description}>
          Encuentra casas, departamentos y terrenos cerca de ti en Santa Cruz.
          Contacta directo al propietario.
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.btnWhite}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.btnWhiteText}>Crear cuenta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.btnOutlineText}>Ya tengo cuenta</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.exploreText}>Explorar sin cuenta →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  bottom: {
    marginTop: 'auto',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 44,
  },
  tagline: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: Spacing.md,
  },
  headline: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.white,
    lineHeight: 40,
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: Fonts.sizes.md,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  buttons: {
    gap: Spacing.md,
  },
  btnWhite: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  btnWhiteText: {
    color: Colors.gray[900],
    fontWeight: '700',
    fontSize: Fonts.sizes.lg,
  },
  btnOutline: {
    borderWidth: 2,
    borderColor: Colors.white,
    paddingVertical: 16,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  btnOutlineText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: Fonts.sizes.lg,
  },
  exploreText: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontSize: Fonts.sizes.md,
    marginTop: Spacing.sm,
  },
});
