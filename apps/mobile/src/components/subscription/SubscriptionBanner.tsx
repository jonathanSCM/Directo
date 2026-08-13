import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSubscription } from '../../context/SubscriptionContext';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

export default function SubscriptionBanner() {
  const { isActive, isFreePlanActive, daysLeft, plans, freePlan, loading, freeTrialUsed } = useSubscription();
  const router = useRouter();

  if (loading) return null;
  if (isActive && !isFreePlanActive) return null; // ya tiene un plan pago, nada que promocionar

  const bestPlan = plans.reduce<typeof plans[0] | null>((best, p) => {
    if (!best) return p;
    return (p.included_properties ?? 1) > (best.included_properties ?? 1) ? p : best;
  }, null);

  const gradient: [string, string] = isFreePlanActive ? ['#F59E0B', '#B45309'] : ['#8B5CF6', '#5B21B6'];
  const icon = isFreePlanActive ? 'trending-up' : 'rocket';

  // El "publica gratis" solo se promete si el plan gratis sigue existiendo y
  // activo (`freePlan` ya viene filtrado a planes activos desde el backend).
  const offerFreePlan = !freeTrialUsed && !!freePlan;

  const headline = isFreePlanActive
    ? daysLeft != null
      ? `Te quedan ${daysLeft} día${daysLeft === 1 ? '' : 's'} de plan gratis`
      : 'Estás en el plan gratis'
    : offerFreePlan
      ? '¡Publica tu propiedad GRATIS!'
      : bestPlan
        ? `Publica hasta ${bestPlan.included_properties} propiedades o más`
        : 'Suscríbete para publicar';

  const subtitle = isFreePlanActive
    ? 'Mejora tu plan para más beneficios'
    : offerFreePlan
      ? `1 propiedad · ${freePlan!.duration_days} días · un solo uso`
      : bestPlan
        ? `Plan ${bestPlan.name} desde ${bestPlan.currency === 'USD' ? '$' : 'Bs.'} ${Number(bestPlan.price).toLocaleString()}`
        : 'Elige un plan y empieza a vender hoy';

  return (
    <TouchableOpacity onPress={() => router.push('/subscription')} activeOpacity={0.88}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={22} color={isFreePlanActive ? Colors.white : '#FBBF24'} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.headline} numberOfLines={1}>{headline}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.white} />
      </LinearGradient>
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
    elevation: 6,
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
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
