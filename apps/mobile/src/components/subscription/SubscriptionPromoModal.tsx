import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscription, Plan } from '../../context/SubscriptionContext';
import { useAuth } from '../../context/AuthContext';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import { describeUpgradeBenefits } from '../../utils/subscriptionCopy';

// ── Reglas de frecuencia ──────────────────────────────────────────────────
// No queremos ser invasivos, pero sí más presentes que antes: se muestra
// como mucho cada COOLDOWN_HOURS horas, con un tope diario, y si el usuario
// lo cierra explícitamente varias veces seguidas ("Ahora no") sin ir nunca a
// /subscription, se aplica un backoff más largo para no fastidiar.
const LAST_SHOWN_KEY = 'sub_promo_last_shown';
const SHOWN_TODAY_KEY = 'sub_promo_shown_today';
const DISMISS_STREAK_KEY = 'sub_promo_dismiss_streak';
const LAST_VARIANT_KEY = 'sub_promo_last_variant';

const COOLDOWN_HOURS = 2;
const BACKOFF_COOLDOWN_HOURS = 24;
const MAX_PER_DAY = 2;
const BACKOFF_AFTER_DISMISSES = 3;

const { width: SCREEN_W } = Dimensions.get('window');

interface Variant {
  icon: keyof typeof Ionicons.glyphMap;
  badge: string;
  title: string;
  subtitle: string;
  gradient: [string, string];
  accent: string;
}

// Variantes para usuarios SIN suscripción activa (nunca se suscribieron, o
// su plan venció/fue cancelado).
function noSubVariants(freeDays: number | null): Variant[] {
  return [
    {
      icon: 'flash',
      badge: 'Oferta por tiempo limitado',
      title: '¡No te quedes fuera!',
      subtitle: 'Publica tu propiedad hoy y llega a cientos de compradores en DIRECTO',
      gradient: ['#7C3AED', '#4C1D95'],
      accent: '#7C3AED',
    },
    {
      icon: 'rocket',
      badge: 'Impulsa tus ventas',
      title: '¡Potencia tu propiedad!',
      subtitle: 'Más visibilidad, más contactos, más rápido',
      gradient: ['#F59E0B', '#B45309'],
      accent: '#B45309',
    },
    {
      icon: 'gift',
      badge: 'Prueba gratis disponible',
      title: freeDays ? `Tenés ${freeDays} días gratis esperando` : 'Tenés una prueba gratis esperando',
      subtitle: 'Publicá tu primera propiedad sin gastar nada',
      gradient: ['#16A34A', '#166534'],
      accent: '#166534',
    },
    {
      icon: 'star',
      badge: 'Comunidad DIRECTO',
      title: 'Unite a cientos de propietarios',
      subtitle: 'Vendé o alquilá directo, sin comisiones de por medio',
      gradient: ['#2563EB', '#1E3A8A'],
      accent: '#1E3A8A',
    },
  ];
}

// Variantes para usuarios que YA están en el plan gratis (retención + upsell
// antes de que venza, en vez de dejar de mostrarles nada una vez suscritos).
// El subtítulo de beneficios se arma con `describeUpgradeBenefits` a partir
// del plan pago real sugerido — nada hardcodeado sobre qué incluye, así que
// si el catálogo de planes cambia el copy sigue siendo correcto.
function upgradeVariants(daysLeft: number | null, targetPlan: Plan | null): Variant[] {
  const daysText = daysLeft != null ? `Te quedan ${daysLeft} día${daysLeft === 1 ? '' : 's'}` : 'Tu plan gratis';
  const benefits = describeUpgradeBenefits(targetPlan);
  return [
    {
      icon: 'trending-up',
      badge: 'Mejorá tu plan',
      title: 'Obtené más beneficios',
      subtitle: benefits,
      gradient: ['#F59E0B', '#B45309'],
      accent: '#B45309',
    },
    {
      icon: 'time',
      badge: `${daysText} de tu plan gratis`,
      title: 'No pierdas visibilidad',
      subtitle: 'Renová con un plan pago y seguí publicando sin cortes',
      gradient: ['#7C3AED', '#4C1D95'],
      accent: '#7C3AED',
    },
    {
      icon: 'star',
      badge: 'Destacá tu propiedad',
      title: 'Llegá a más compradores',
      subtitle: benefits,
      gradient: ['#2563EB', '#1E3A8A'],
      accent: '#1E3A8A',
    },
  ];
}

function planFeatures(plan: Plan): { icon: string; text: string }[] {
  const feats: { icon: string; text: string }[] = [];
  feats.push({
    icon: 'home',
    text: `${plan.included_properties} propiedad(es) incluidas`,
  });
  if (Number(plan.extra_property_price) > 0) {
    feats.push({
      icon: 'add-circle',
      text: `Propiedades extra a ${plan.currency === 'USD' ? '$' : 'Bs.'} ${Number(plan.extra_property_price)}`,
    });
  }
  feats.push({ icon: 'images', text: 'Hasta 10 fotos por propiedad' });
  if (plan.priority_in_results) {
    feats.push({ icon: 'trending-up', text: 'Prioridad en resultados de búsqueda' });
  }
  if (plan.allows_featured) {
    feats.push({ icon: 'star', text: 'Propiedad destacada' });
  }
  if (plan.includes_statistics) {
    feats.push({ icon: 'bar-chart', text: 'Estadísticas de visitas' });
  }
  feats.push({ icon: 'logo-whatsapp', text: 'Contacto directo por WhatsApp' });
  feats.push({ icon: 'map', text: 'Visibilidad en el mapa' });
  return feats;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function SubscriptionPromoModal() {
  const { isActive, isFreePlanActive, daysLeft, plans, freePlan, cheapestPaidPlan, loading, freeTrialUsed } =
    useSubscription();
  const { user, switchRole } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<Variant | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (loading || !user) return;
    // Con un plan pago activo no hay nada que promocionar; con el plan
    // gratis activo sí seguimos mostrando (empuje a mejorar/renovar).
    if (isActive && !isFreePlanActive) return;

    const check = async () => {
      const [lastRaw, shownTodayRaw, streakRaw] = await Promise.all([
        AsyncStorage.getItem(LAST_SHOWN_KEY),
        AsyncStorage.getItem(SHOWN_TODAY_KEY),
        AsyncStorage.getItem(DISMISS_STREAK_KEY),
      ]);

      const now = Date.now();
      const streak = parseInt(streakRaw ?? '0', 10);
      const cooldownMs =
        (streak >= BACKOFF_AFTER_DISMISSES ? BACKOFF_COOLDOWN_HOURS : COOLDOWN_HOURS) *
        60 *
        60 *
        1000;
      if (lastRaw && now - parseInt(lastRaw, 10) < cooldownMs) return;

      const [shownDay, shownCount] = (shownTodayRaw ?? '').split(':');
      const countToday = shownDay === todayKey() ? parseInt(shownCount ?? '0', 10) : 0;
      if (countToday >= MAX_PER_DAY) return;

      // Elegir una variante distinta a la última mostrada (se identifica por
      // su badge, no por índice — el pool cambia de contenido día a día
      // porque incluye "días restantes").
      const lastBadge = await AsyncStorage.getItem(LAST_VARIANT_KEY);
      // La variante "prueba gratis" solo entra al pool si ese plan sigue
      // existiendo y activo (`freePlan` ya viene filtrado por el backend) y
      // el usuario no la usó todavía — si el admin desactiva el plan gratis,
      // esta variante deja de aparecer sola.
      const offerFreeTrial = !freeTrialUsed && !!freePlan;
      const pool = isFreePlanActive
        ? upgradeVariants(daysLeft, cheapestPaidPlan)
        : offerFreeTrial
          ? noSubVariants(freePlan!.duration_days)
          : noSubVariants(null).filter((v) => v.badge !== 'Prueba gratis disponible');
      let idx = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && pool[idx].badge === lastBadge) {
        idx = (idx + 1) % pool.length;
      }
      const chosen = pool[idx];

      await Promise.all([
        AsyncStorage.setItem(LAST_SHOWN_KEY, now.toString()),
        AsyncStorage.setItem(SHOWN_TODAY_KEY, `${todayKey()}:${countToday + 1}`),
        AsyncStorage.setItem(LAST_VARIANT_KEY, chosen.badge),
      ]);

      setVariant(chosen);
      setVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      ]).start();
    };
    const timer = setTimeout(check, 1500);
    return () => clearTimeout(timer);
  }, [loading, isActive, isFreePlanActive, daysLeft, user, freeTrialUsed, freePlan, cheapestPaidPlan]);

  const close = (explicitDismiss: boolean) => {
    if (explicitDismiss) {
      AsyncStorage.getItem(DISMISS_STREAK_KEY).then((v) => {
        const streak = parseInt(v ?? '0', 10) + 1;
        AsyncStorage.setItem(DISMISS_STREAK_KEY, streak.toString());
      });
    }
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setVisible(false),
    );
  };

  const goToSub = () => {
    AsyncStorage.setItem(DISMISS_STREAK_KEY, '0');
    close(false);
    setTimeout(async () => {
      if (user && user.active_role !== 'owner') await switchRole('owner');
      router.push('/subscription');
    }, 300);
  };

  if (!visible || !variant || plans.length === 0) return null;

  // Ya en el plan gratis: no tiene sentido volver a ofrecérselo, el
  // carrusel muestra solo los planes pagos a los que puede mejorar.
  const paidPlans = plans.filter((p) => Number(p.price) > 0);
  const displayPlans = isFreePlanActive && paidPlans.length > 0 ? paidPlans : plans;

  const topPlan = displayPlans.reduce((a, b) =>
    (a.included_properties ?? 1) > (b.included_properties ?? 1) ? a : b,
  );
  const cheapestPaid = plans
    .filter((p) => Number(p.price) > 0)
    .reduce<Plan | null>((min, p) => (!min || Number(p.price) < Number(min.price) ? p : min), null);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => close(true)}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => close(true)} hitSlop={12}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>

          <LinearGradient
            colors={variant.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroWrap}
          >
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{variant.badge}</Text>
            </View>
            <View style={styles.heroIcon}>
              <Ionicons name={variant.icon} size={36} color={Colors.white} />
            </View>
            <Text style={styles.heroTitle}>{variant.title}</Text>
            <Text style={styles.heroSubtitle}>{variant.subtitle}</Text>
            {cheapestPaid && (
              <Text style={styles.heroPriceNote}>
                Planes desde {cheapestPaid.currency === 'USD' ? '$' : 'Bs.'} {Number(cheapestPaid.price).toLocaleString()}
              </Text>
            )}
          </LinearGradient>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={{ paddingHorizontal: 4 }}
          >
            {displayPlans.map((plan) => {
              const price = Number(plan.price);
              const feats = planFeatures(plan);
              const isTop = plan.id === topPlan.id && displayPlans.length > 1;
              return (
                <View key={plan.id} style={[styles.planSlide, isTop && { borderColor: variant.accent, borderWidth: 2 }]}>
                  {isTop && (
                    <View style={[styles.popularBadge, { backgroundColor: variant.accent }]}>
                      <Text style={styles.popularText}>Popular</Text>
                    </View>
                  )}
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.price, { color: variant.accent }]}>
                      {price === 0 ? 'Gratis' : `${plan.currency === 'USD' ? '$' : 'Bs.'} ${price.toLocaleString()}`}
                    </Text>
                    <Text style={styles.duration}>/ {plan.duration_days} días</Text>
                  </View>
                  {feats.slice(0, 5).map((f, i) => (
                    <View key={i} style={styles.featRow}>
                      <Ionicons name={f.icon as any} size={15} color={variant.accent} />
                      <Text style={styles.featText}>{f.text}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>

          {!freeTrialUsed && !isFreePlanActive && freePlan && (
            <View style={styles.trialNote}>
              <Ionicons name="gift" size={16} color="#F59E0B" />
              <Text style={styles.trialNoteText}>
                ¡Tienes una prueba gratuita de {freePlan.duration_days} días disponible!
              </Text>
            </View>
          )}

          <TouchableOpacity onPress={goToSub} activeOpacity={0.85}>
            <LinearGradient
              colors={variant.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaBtn}
            >
              <Ionicons name={isFreePlanActive ? 'trending-up' : 'rocket'} size={18} color={Colors.white} />
              <Text style={styles.ctaText}>
                {isFreePlanActive ? 'Ver planes y mejorar' : 'Ver planes y suscribirme'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => close(true)} style={styles.dismissBtn}>
            <Text style={styles.dismissText}>Ahora no</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const SLIDE_W = SCREEN_W - 80;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: Colors.white,
    borderRadius: 24,
    overflow: 'hidden',
    paddingBottom: 20,
  },
  closeBtn: { position: 'absolute', top: 14, right: 14, zIndex: 10, padding: 4 },
  heroWrap: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: Spacing.xl,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
  },
  heroBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.white, textAlign: 'center' },
  heroSubtitle: {
    fontSize: Fonts.sizes.sm,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  heroPriceNote: {
    fontSize: Fonts.sizes.xs,
    color: Colors.white,
    fontWeight: '700',
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  carousel: { maxHeight: 230, marginTop: Spacing.xl, marginBottom: Spacing.lg },
  planSlide: {
    width: SLIDE_W,
    marginLeft: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  popularText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  planName: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4, marginBottom: 10 },
  price: { fontSize: Fonts.sizes.xl, fontWeight: '800' },
  duration: { fontSize: Fonts.sizes.xs, color: Colors.gray[500] },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  featText: { fontSize: Fonts.sizes.sm, color: Colors.gray[700], flex: 1 },

  trialNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  trialNoteText: { fontSize: Fonts.sizes.sm, color: '#92400E', fontWeight: '600', flex: 1 },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.xl,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  ctaText: { color: Colors.white, fontSize: Fonts.sizes.md, fontWeight: '700' },
  dismissBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 6 },
  dismissText: { fontSize: Fonts.sizes.sm, color: Colors.gray[400] },
});
