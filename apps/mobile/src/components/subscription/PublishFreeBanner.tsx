import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

/**
 * Banner fijo sobre el tab bar para el propietario, con 3 estados:
 * - Nunca usó el plan gratis          -> CTA que lo manda a elegir plan
 *   (ya no lo activa solo con un toque, ver `goToPlans`).
 * - Está usando el plan gratis ahora  -> empuja a mejorar de plan, mostrando
 *   cuántos días le quedan (retención + upsell antes de que venza).
 * - Ya usó el plan gratis y no tiene sub activa -> empuja a comprar un plan.
 */
export default function PublishFreeBanner() {
  const { user, switchRole } = useAuth();
  const { isActive, isFreePlanActive, daysLeft, loading, freeTrialUsed, freePlan } =
    useSubscription();
  const router = useRouter();
  const pathname = usePathname();

  if (loading || !user || user.active_role !== 'owner') return null;
  if (isActive && !isFreePlanActive) return null; // ya tiene un plan pago activo, nada que promocionar
  // Tapa el botón de cerrar sesión y el resto del menú en Perfil — ahí no.
  if (pathname?.includes('/profile')) return null;

  const goToPlans = async () => {
    if (user.active_role !== 'owner') await switchRole('owner');
    router.push('/subscription');
  };

  if (isFreePlanActive) {
    return (
      <View style={styles.wrap}>
        <TouchableOpacity onPress={goToPlans} activeOpacity={0.88}>
          <LinearGradient colors={['#F59E0B', '#B45309']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
              <Ionicons name="trending-up" size={22} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {daysLeft != null
                  ? `A tu plan gratis le quedan ${daysLeft} día${daysLeft === 1 ? '' : 's'}`
                  : 'Estás en el plan gratis'}
              </Text>
              <Text style={styles.subtitle}>Mejora tu plan para más beneficios</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  {/* Solo prometemos el plan gratis si sigue existiendo y activo en el
      catálogo — `freePlan` sale de `plans` (ya filtrado a activos por el
      backend), así que si el admin lo desactiva esta promo desaparece sola. */}
  if (!freeTrialUsed && freePlan) {
    return (
      <View style={styles.wrap}>
        <TouchableOpacity onPress={goToPlans} activeOpacity={0.88}>
          <LinearGradient colors={['#22C55E', '#15803D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
            <View style={styles.iconWrap}>
              <Ionicons name="gift" size={22} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>¡Publica tu propiedad GRATIS!</Text>
              <Text style={styles.subtitle}>1 propiedad · {freePlan.duration_days} días · sin tarjeta</Text>
            </View>
            <View style={styles.cta}>
              <Text style={[styles.ctaText, { color: '#15803D' }]}>Ver plan</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={goToPlans} activeOpacity={0.88}>
        <LinearGradient colors={['#8B5CF6', '#5B21B6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
          <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
            <Ionicons name="rocket" size={22} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Compra un plan para seguir publicando</Text>
            <Text style={styles.subtitle}>Tu plan gratis ya fue usado</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.white} />
        </LinearGradient>
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
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  ctaText: { fontWeight: '800', fontSize: Fonts.sizes.sm },
});
