import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSubscription } from '../../context/SubscriptionContext';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

export default function SubscriptionBanner() {
  const { isActive, plans, loading, freeTrialUsed } = useSubscription();
  const router = useRouter();

  if (loading || isActive) return null;

  const bestPlan = plans.reduce<typeof plans[0] | null>((best, p) => {
    if (!best) return p;
    return (p.included_properties ?? 1) > (best.included_properties ?? 1) ? p : best;
  }, null);

  const headline = !freeTrialUsed
    ? '¡Publica tu propiedad GRATIS!'
    : bestPlan
      ? `Publica hasta ${bestPlan.included_properties} propiedades o más`
      : 'Suscríbete para publicar';

  const subtitle = !freeTrialUsed
    ? '1 propiedad · 30 días · un solo uso'
    : bestPlan
      ? `Plan ${bestPlan.name} desde ${bestPlan.currency === 'USD' ? '$' : 'Bs.'} ${Number(bestPlan.price).toLocaleString()}`
      : 'Elige un plan y empieza a vender hoy';

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => router.push('/subscription')}
      activeOpacity={0.85}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="rocket" size={22} color="#F59E0B" />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.headline} numberOfLines={1}>{headline}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.white} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: '#7C3AED',
    elevation: 4,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: { flex: 1 },
  headline: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.white },
  subtitle: { fontSize: Fonts.sizes.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
});
