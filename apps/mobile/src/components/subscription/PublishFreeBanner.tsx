import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import api from '../../services/api';

/**
 * Banner fijo sobre el tab bar mientras el propietario no tenga suscripción:
 * - Nunca usó el plan gratis  -> CTA que lo activa y abre el formulario de
 *   crear propiedad de una vez.
 * - Ya lo usó                 -> empuja a comprar un plan de pago.
 */
export default function PublishFreeBanner() {
  const { user } = useAuth();
  const { isActive, loading, freeTrialUsed, plans, refresh } = useSubscription();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (loading || isActive || user?.active_role !== 'owner') return null;

  const claimFree = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const freePlan = plans.find((p) => Number(p.price) === 0);
      if (!freePlan) {
        router.push('/subscription');
        return;
      }
      await api.post('/subscriptions/activate', { plan_id: freePlan.id });
      await refresh();
      router.push('/create-property');
    } catch {
      // Ya usado / conflicto: que elija plan en la pantalla completa
      router.push('/subscription');
    } finally {
      setBusy(false);
    }
  };

  if (!freeTrialUsed) {
    return (
      <View style={styles.wrap}>
        <TouchableOpacity style={[styles.banner, styles.bannerFree]} onPress={claimFree} activeOpacity={0.85}>
          <View style={styles.iconWrap}>
            <Ionicons name="gift" size={20} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>¡Publica tu propiedad GRATIS!</Text>
            <Text style={styles.subtitle}>1 propiedad · 30 días · sin tarjeta</Text>
          </View>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{busy ? '...' : 'Publicar'}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.banner, styles.bannerPaid]}
        onPress={() => router.push('/subscription')}
        activeOpacity={0.85}
      >
        <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Ionicons name="rocket" size={20} color={Colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Compra un plan para seguir publicando</Text>
          <Text style={styles.subtitle}>Tu plan gratis ya fue usado</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    // Sobre el tab bar (85 de alto)
    bottom: 90,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 900,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  bannerFree: { backgroundColor: '#16A34A' },
  bannerPaid: { backgroundColor: '#7C3AED' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { color: Colors.white, fontSize: Fonts.sizes.sm, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: Fonts.sizes.xs, marginTop: 1 },
  cta: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  ctaText: { color: '#16A34A', fontWeight: '800', fontSize: Fonts.sizes.sm },
});
