import { useRouter } from 'expo-router';
import React from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Logo } from '../../src/components/Logo';

const IS_DESKTOP = Dimensions.get('window').width >= 768;

export default function OnboardingWeb() {
  const router = useRouter();

  return (
    <ScrollView style={S.root} contentContainerStyle={S.rootContent}>
      {/* ── Left panel: brand ── */}
      <View style={S.left}>
        {/* Background watermark: en mobile se ve gigante y cortado, mejor ocultarlo */}
        {IS_DESKTOP && (
          <View style={S.watermark} pointerEvents="none">
            <Text style={S.watermarkText}>DIRECTO</Text>
          </View>
        )}

        <View style={S.leftInner}>
          <View style={S.logoRow}>
            <Logo size={IS_DESKTOP ? 44 : 36} variant="white" />
            <Text style={S.brand}>DIRECTO</Text>
          </View>

          <Text style={S.tagline}>COMPRA · VENDE · SIN INTERMEDIARIOS</Text>

          <Text style={S.headline}>
            Tu próximo hogar,{'\n'}en el mapa.
          </Text>

          <Text style={S.desc}>
            Encuentra casas, departamentos y terrenos cerca de ti en Santa Cruz.
            Contacta directo al propietario, sin comisiones ni intermediarios.
          </Text>

          {IS_DESKTOP && (
            <View style={S.stats}>
              {[
                { n: '500+', label: 'Propiedades' },
                { n: '100%', label: 'Sin agentes' },
                { n: '0%', label: 'Comisión' },
              ].map(({ n, label }) => (
                <View key={label} style={S.statItem}>
                  <Text style={S.statNum}>{n}</Text>
                  <Text style={S.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* ── Right panel: CTA card ── */}
      <View style={S.right}>
        <View style={S.card}>
          <View style={S.cardLogo}>
            <Logo size={36} variant="blue" />
          </View>

          <Text style={S.cardTitle}>Bienvenido a DIRECTO</Text>
          <Text style={S.cardSub}>
            La plataforma inmobiliaria sin comisiones de Bolivia
          </Text>

          <View style={S.cardBtns}>
            <TouchableOpacity
              style={S.btnPrimary}
              onPress={() => router.push('/(auth)/register')}
            >
              <Text style={S.btnPrimaryText}>Crear cuenta gratis</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={S.btnOutline}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={S.btnOutlineText}>Ya tengo cuenta</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
              <Text style={S.exploreLink}>Explorar sin cuenta →</Text>
            </TouchableOpacity>
          </View>

          <View style={S.cardFeatures}>
            {[
              '🏠  Publica tu propiedad gratis',
              '📍  Mapa interactivo en tiempo real',
              '💬  Contacto directo con el propietario',
            ].map(feat => (
              <Text key={feat} style={S.featureText}>{feat}</Text>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const BLUE = '#1D4ED8';
const DARK_BLUE = '#1239A8';

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  rootContent: { flexGrow: 1, flexDirection: IS_DESKTOP ? 'row' : 'column' },

  // Left panel
  left: {
    flex: IS_DESKTOP ? 1 : undefined,
    backgroundColor: BLUE,
    overflow: 'hidden' as any,
    position: 'relative',
  },
  watermark: {
    position: 'absolute',
    bottom: -60,
    right: -80,
    opacity: 0.08,
  },
  watermarkText: {
    fontSize: 200,
    fontWeight: '900' as any,
    color: '#fff',
    letterSpacing: -8,
    userSelect: 'none' as any,
  },
  leftInner: {
    flex: IS_DESKTOP ? 1 : undefined,
    justifyContent: 'center',
    paddingHorizontal: IS_DESKTOP ? 56 : 24,
    paddingVertical: IS_DESKTOP ? 60 : 36,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: IS_DESKTOP ? 32 : 20 },
  brand: { fontSize: IS_DESKTOP ? 28 : 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 2.5,
    marginBottom: IS_DESKTOP ? 20 : 12,
  },
  headline: {
    fontSize: IS_DESKTOP ? 46 : 26,
    fontWeight: '800',
    color: '#fff',
    lineHeight: IS_DESKTOP ? 54 : 32,
    marginBottom: IS_DESKTOP ? 20 : 12,
    letterSpacing: -1,
  },
  desc: {
    fontSize: IS_DESKTOP ? 16 : 14,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: IS_DESKTOP ? 26 : 20,
    maxWidth: 420,
    marginBottom: IS_DESKTOP ? 44 : 0,
  },
  stats: { flexDirection: 'row', gap: 40 },
  statItem: { gap: 4 },
  statNum: { fontSize: 32, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },

  // Right panel
  right: {
    width: IS_DESKTOP ? 480 : '100%',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: IS_DESKTOP ? 32 : 20,
    paddingVertical: IS_DESKTOP ? 48 : 28,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 36,
    boxShadow: '0 8px 32px rgba(0,0,0,0.09)' as any,
  },
  cardLogo: { alignItems: 'center', marginBottom: 20 },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  cardBtns: { gap: 12 },
  btnPrimary: {
    backgroundColor: BLUE,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: BLUE,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  btnOutlineText: { color: BLUE, fontWeight: '700', fontSize: 16 },
  exploreLink: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 4,
    cursor: 'pointer' as any,
  },
  cardFeatures: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 10,
  },
  featureText: { fontSize: 13.5, color: '#374151', lineHeight: 20 },
});
