import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSubscription, Plan } from '../../context/SubscriptionContext';
import { useAuth } from '../../context/AuthContext';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { describeUpgradeBenefits } from '../../utils/subscriptionCopy';

const NO_SUB_MESSAGES = (freeDays: number | null) => [
  { icon: 'trending-up', text: 'Los propietarios Premium reciben 2x más consultas' },
  { icon: 'search', text: 'Tus propiedades aparecerían más arriba en las búsquedas' },
  { icon: 'star', text: 'Destaca tus propiedades con un plan Premium' },
  { icon: 'rocket', text: 'Aprovecha y suscríbete para recibir beneficios exclusivos' },
  { icon: 'people', text: 'Llega a más compradores con una suscripción activa' },
  { icon: 'gift', text: `¡No pierdas tu prueba gratuita de ${freeDays ?? 30} días!` },
  { icon: 'flash', text: 'Publica más propiedades y vende más rápido' },
  { icon: 'ribbon', text: 'Suscríbete y obtén estadísticas de tus propiedades' },
];

// Mensajes para quien ya está en el plan gratis: empuje a mejorar/renovar en
// vez de "suscribite" (ya lo hizo) — con los días que le quedan cuando se
// conocen, para meter algo de urgencia sin ser agresivos. El beneficio
// concreto sale de `describeUpgradeBenefits` (plan real, no hardcodeado).
const UPGRADE_MESSAGES = (daysLeft: number | null, targetPlan: Plan | null) => [
  { icon: 'trending-up', text: describeUpgradeBenefits(targetPlan) },
  {
    icon: 'time',
    text: daysLeft != null
      ? `Te quedan ${daysLeft} día${daysLeft === 1 ? '' : 's'} de plan gratis — renová para no cortar tu publicación`
      : 'Renová tu plan para seguir publicando sin cortes',
  },
];

const INTERVAL_MS = 4 * 60 * 1000;
const DISPLAY_MS = 6000;

type Message = { icon: string; text: string };

export default function SubscriptionToast() {
  const { isActive, isFreePlanActive, daysLeft, loading, freeTrialUsed, freePlan, cheapestPaidPlan } =
    useSubscription();
  const { user } = useAuth();
  const router = useRouter();
  const [currentMsg, setCurrentMsg] = useState<Message | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const msgIndex = useRef(0);
  const isOwner = user?.active_role === 'owner';

  useEffect(() => {
    if (loading || !isOwner) return;
    if (isActive && !isFreePlanActive) return; // plan pago activo: nada que ofrecer

    const show = () => {
      const offerFreeTrial = !freeTrialUsed && !!freePlan;
      const available = isFreePlanActive
        ? UPGRADE_MESSAGES(daysLeft, cheapestPaidPlan)
        : offerFreeTrial
          ? NO_SUB_MESSAGES(freePlan!.duration_days)
          : NO_SUB_MESSAGES(null).filter((m) => m.icon !== 'gift');
      const msg = available[msgIndex.current % available.length];
      msgIndex.current++;
      setCurrentMsg(msg);

      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setCurrentMsg(null));
      }, DISPLAY_MS);
    };

    const initialDelay = setTimeout(show, 30000);
    const interval = setInterval(show, INTERVAL_MS);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [loading, isActive, isFreePlanActive, daysLeft, isOwner, freeTrialUsed, freePlan, cheapestPaidPlan]);

  if (!currentMsg) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <TouchableOpacity
        style={styles.toast}
        onPress={() => router.push('/subscription')}
        activeOpacity={0.9}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={currentMsg.icon as any} size={18} color={Colors.white} />
        </View>
        <Text style={styles.text} numberOfLines={2}>{currentMsg.text}</Text>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 54,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#7C3AED',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { flex: 1, fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.white, lineHeight: 18 },
});
