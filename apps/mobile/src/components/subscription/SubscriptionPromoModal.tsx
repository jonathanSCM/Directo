import { Ionicons } from '@expo/vector-icons';
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

const STORAGE_KEY = 'sub_promo_last_shown';
const { width: SCREEN_W } = Dimensions.get('window');

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

export default function SubscriptionPromoModal() {
  const { isActive, plans, loading, freeTrialUsed } = useSubscription();
  const { user } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (loading || isActive || !user || user.active_role !== 'owner') return;

    const check = async () => {
      const last = await AsyncStorage.getItem(STORAGE_KEY);
      const now = Date.now();
      if (last && now - parseInt(last, 10) < 24 * 60 * 60 * 1000) return;
      await AsyncStorage.setItem(STORAGE_KEY, now.toString());
      setVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      ]).start();
    };
    const timer = setTimeout(check, 1500);
    return () => clearTimeout(timer);
  }, [loading, isActive, user]);

  const close = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setVisible(false),
    );
  };

  const goToSub = () => {
    close();
    setTimeout(() => router.push('/subscription'), 300);
  };

  if (!visible || plans.length === 0) return null;

  const topPlan = plans.reduce((a, b) =>
    (a.included_properties ?? 1) > (b.included_properties ?? 1) ? a : b,
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={close} hitSlop={12}>
            <Ionicons name="close" size={22} color={Colors.gray[400]} />
          </TouchableOpacity>

          <View style={styles.heroWrap}>
            <View style={styles.heroIcon}>
              <Ionicons name="diamond" size={40} color="#F59E0B" />
            </View>
            <Text style={styles.heroTitle}>¡Potencia tus ventas!</Text>
            <Text style={styles.heroSubtitle}>
              Suscríbete y llega a miles de compradores en DIRECTO
            </Text>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={{ paddingHorizontal: 4 }}
          >
            {plans.map((plan) => {
              const price = Number(plan.price);
              const feats = planFeatures(plan);
              const isTop = plan.id === topPlan.id && plans.length > 1;
              return (
                <View key={plan.id} style={[styles.planSlide, isTop && styles.planSlideTop]}>
                  {isTop && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>Popular</Text>
                    </View>
                  )}
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>
                      {price === 0 ? 'Gratis' : `${plan.currency === 'USD' ? '$' : 'Bs.'} ${price.toLocaleString()}`}
                    </Text>
                    <Text style={styles.duration}>/ {plan.duration_days} días</Text>
                  </View>
                  {feats.slice(0, 5).map((f, i) => (
                    <View key={i} style={styles.featRow}>
                      <Ionicons name={f.icon as any} size={15} color="#7C3AED" />
                      <Text style={styles.featText}>{f.text}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>

          {!freeTrialUsed && (
            <View style={styles.trialNote}>
              <Ionicons name="gift" size={16} color="#F59E0B" />
              <Text style={styles.trialNoteText}>
                ¡Tienes una prueba gratuita de 30 días disponible!
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.ctaBtn} onPress={goToSub} activeOpacity={0.8}>
            <Ionicons name="rocket" size={18} color={Colors.white} />
            <Text style={styles.ctaText}>Ver planes y suscribirme</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={close} style={styles.dismissBtn}>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 10, padding: 4 },
  heroWrap: { alignItems: 'center', marginBottom: Spacing.xl },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.gray[900] },
  heroSubtitle: {
    fontSize: Fonts.sizes.sm,
    color: Colors.gray[500],
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  carousel: { maxHeight: 230, marginBottom: Spacing.lg },
  planSlide: {
    width: SLIDE_W,
    marginRight: 12,
    backgroundColor: '#F5F3FF',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
  },
  planSlideTop: { borderColor: '#7C3AED', borderWidth: 2 },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  popularText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  planName: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4, marginBottom: 10 },
  price: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: '#7C3AED' },
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
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    borderRadius: Radius.lg,
    elevation: 3,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  ctaText: { color: Colors.white, fontSize: Fonts.sizes.md, fontWeight: '700' },
  dismissBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 6 },
  dismissText: { fontSize: Fonts.sizes.sm, color: Colors.gray[400] },
});
