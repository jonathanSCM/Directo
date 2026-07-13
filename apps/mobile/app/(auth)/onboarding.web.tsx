import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Logo } from '../../src/components/Logo';

export default function OnboardingWeb() {
  const router = useRouter();

  return (
    <View style={S.root}>
      {/* ── Left panel: brand ── */}
      <View style={S.left}>
        {/* Background watermark */}
        <View style={S.watermark} pointerEvents="none">
          <Text style={S.watermarkText}>DIRECTO</Text>
        </View>

        <View style={S.leftInner}>
          <View style={S.logoRow}>
            <Logo size={44} variant="white" />
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
    </View>
  );
}

const BLUE = '#1D4ED8';
const DARK_BLUE = '#1239A8';

const S = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#fff' },

  // Left panel
  left: {
    flex: 1,
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
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 56,
    paddingVertical: 60,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 },
  brand: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 2.5,
    marginBottom: 20,
  },
  headline: {
    fontSize: 46,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 54,
    marginBottom: 20,
    letterSpacing: -1,
  },
  desc: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 26,
    maxWidth: 420,
    marginBottom: 44,
  },
  stats: { flexDirection: 'row', gap: 40 },
  statItem: { gap: 4 },
  statNum: { fontSize: 32, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },

  // Right panel
  right: {
    width: 480,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
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
