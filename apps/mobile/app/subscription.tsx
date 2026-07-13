import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';
import api from '../src/services/api';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  currency: string;
  duration_days: number;
  max_active_properties: number | null;
  max_images_per_property: number | null;
  allows_featured: boolean;
  includes_statistics: boolean;
  priority_in_results: boolean;
  publication_duration_days: number | null;
}

interface Subscription {
  id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  subscription_plans: Plan;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: '#22C55E' },
  expired: { label: 'Vencida', color: '#EF4444' },
  pending_payment: { label: 'Pendiente de pago', color: '#F59E0B' },
  cancelled: { label: 'Cancelada', color: Colors.gray[500] },
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [freeTrialUsed, setFreeTrialUsed] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, plansRes, trialRes] = await Promise.all([
        api.get('/subscriptions/me').catch(() => ({ data: null })),
        api.get('/subscription-plans'),
        api.get('/subscriptions/free-trial/status').catch(() => ({ data: { used: true } })),
      ]);
      setSubscription(subRes.data);
      setPlans(plansRes.data);
      setFreeTrialUsed(trialRes.data.used);
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isActive = subscription?.status === 'active';
  const statusInfo = STATUS_LABELS[subscription?.status ?? ''] ?? { label: 'Sin suscripción', color: Colors.gray[400] };

  const handleFreeTrial = async () => {
    try {
      setActivating('trial');
      await api.post('/subscriptions/free-trial');
      Alert.alert('Prueba activada', 'Tienes 30 días para publicar 1 propiedad gratis.');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'No se pudo activar');
    } finally {
      setActivating(null);
    }
  };

  const handleActivate = async (planId: string) => {
    try {
      setActivating(planId);
      const { data } = await api.post('/subscriptions/activate', { plan_id: planId });
      if (data.status === 'pending_payment') {
        Alert.alert('Pendiente de pago', 'Realiza el pago por QR para activar tu suscripción.');
      } else {
        Alert.alert('Suscripción activada', 'Ya puedes publicar propiedades.');
      }
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'No se pudo contratar');
    } finally {
      setActivating(null);
    }
  };

  const handleRenew = async () => {
    try {
      setActivating('renew');
      await api.post('/subscriptions/renew');
      Alert.alert('Renovación', 'Tu suscripción ha sido renovada.');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'No se pudo renovar');
    } finally {
      setActivating(null);
    }
  };

  const daysLeft = () => {
    if (!subscription?.end_date) return null;
    const diff = new Date(subscription.end_date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi suscripción</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current subscription */}
        {subscription ? (
          <View style={styles.currentCard}>
            <View style={styles.currentHeader}>
              <View>
                <Text style={styles.planName}>{subscription.subscription_plans?.name ?? 'Plan'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                  <Text style={styles.statusText}>{statusInfo.label}</Text>
                </View>
              </View>
              <Ionicons name="ribbon" size={36} color={Colors.primary} />
            </View>

            {isActive && (
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Inicio</Text>
                  <Text style={styles.detailValue}>{formatDate(subscription.start_date)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Vence</Text>
                  <Text style={styles.detailValue}>{formatDate(subscription.end_date)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Días restantes</Text>
                  <Text style={[styles.detailValue, styles.daysText]}>{daysLeft()}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Propiedades</Text>
                  <Text style={styles.detailValue}>
                    {subscription.subscription_plans?.max_active_properties ?? '∞'}
                  </Text>
                </View>
              </View>
            )}

            {(subscription.status === 'expired' || subscription.status === 'active') && (
              <TouchableOpacity
                style={styles.renewBtn}
                onPress={handleRenew}
                disabled={activating === 'renew'}
              >
                <Ionicons name="refresh" size={18} color={Colors.white} />
                <Text style={styles.renewBtnText}>
                  {activating === 'renew' ? 'Renovando...' : 'Renovar suscripción'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.noSubCard}>
            <Ionicons name="ribbon-outline" size={48} color={Colors.gray[300]} />
            <Text style={styles.noSubTitle}>Sin suscripción</Text>
            <Text style={styles.noSubDesc}>
              Necesitas una suscripción para publicar propiedades en DIRECTO
            </Text>
          </View>
        )}

        {/* Free trial */}
        {!freeTrialUsed && !isActive && (
          <TouchableOpacity
            style={styles.trialCard}
            onPress={handleFreeTrial}
            disabled={activating === 'trial'}
          >
            <View style={styles.trialLeft}>
              <Ionicons name="gift" size={28} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.trialTitle}>Prueba gratuita</Text>
                <Text style={styles.trialDesc}>30 días gratis para publicar 1 propiedad</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}

        {/* Plans */}
        <Text style={styles.sectionTitle}>Planes disponibles</Text>
        {plans.map((plan) => {
          const planPrice = Number(plan.price);
          const isCurrent = subscription?.subscription_plans?.id === plan.id && isActive;
          return (
            <View key={plan.id} style={[styles.planCard, isCurrent && styles.planCardCurrent]}>
              <View style={styles.planHeader}>
                <Text style={styles.planCardName}>{plan.name}</Text>
                {isCurrent && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Actual</Text>
                  </View>
                )}
              </View>

              <View style={styles.planPriceRow}>
                <Text style={styles.planPrice}>
                  {planPrice === 0 ? 'Gratis' : `${plan.currency === 'USD' ? '$' : 'Bs.'} ${planPrice.toLocaleString()}`}
                </Text>
                <Text style={styles.planDuration}>/ {plan.duration_days} días</Text>
              </View>

              <View style={styles.planFeatures}>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.featureText}>
                    {plan.max_active_properties
                      ? `Hasta ${plan.max_active_properties} propiedad(es)`
                      : 'Propiedades ilimitadas'}
                  </Text>
                </View>
                {plan.max_images_per_property && (
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.featureText}>{plan.max_images_per_property} fotos por propiedad</Text>
                  </View>
                )}
                {plan.priority_in_results && (
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Prioridad en resultados</Text>
                  </View>
                )}
                {plan.allows_featured && (
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Propiedad destacada</Text>
                  </View>
                )}
                {plan.includes_statistics && (
                  <View style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.featureText}>Estadísticas de visitas</Text>
                  </View>
                )}
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.featureText}>Visibilidad en el mapa</Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.featureText}>Contacto directo por WhatsApp</Text>
                </View>
              </View>

              {!isCurrent && (
                <TouchableOpacity
                  style={styles.activateBtn}
                  onPress={() => handleActivate(plan.id)}
                  disabled={activating === plan.id}
                >
                  <Text style={styles.activateBtnText}>
                    {activating === plan.id ? 'Contratando...' : 'Contratar plan'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  content: { padding: Spacing.xxl, paddingBottom: 60 },

  // Current subscription
  currentCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  currentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  planName: { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.gray[900] },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full, marginTop: Spacing.xs },
  statusText: { color: Colors.white, fontSize: Fonts.sizes.xs, fontWeight: '700' },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  detailItem: {
    width: '46%',
    backgroundColor: Colors.gray[50],
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  detailLabel: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginBottom: 2 },
  detailValue: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.gray[800] },
  daysText: { color: Colors.primary, fontSize: Fonts.sizes.xl },
  renewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.lg,
  },
  renewBtnText: { color: Colors.white, fontSize: Fonts.sizes.md, fontWeight: '700' },

  // No subscription
  noSubCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xxxl,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  noSubTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[700], marginTop: Spacing.lg },
  noSubDesc: { fontSize: Fonts.sizes.sm, color: Colors.gray[400], textAlign: 'center', marginTop: Spacing.sm },

  // Free trial
  trialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  trialLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  trialTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.gray[900] },
  trialDesc: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginTop: 2 },

  // Plans section
  sectionTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.gray[900],
    marginTop: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  planCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
  },
  planCardCurrent: { borderColor: Colors.primary },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planCardName: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  currentBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  currentBadgeText: { color: Colors.primary, fontSize: Fonts.sizes.xs, fontWeight: '700' },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  planPrice: { fontSize: Fonts.sizes.xxl, fontWeight: '700', color: Colors.primary },
  planDuration: { fontSize: Fonts.sizes.sm, color: Colors.gray[500] },
  planFeatures: { marginTop: Spacing.lg, gap: Spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  featureText: { fontSize: Fonts.sizes.sm, color: Colors.gray[600] },
  activateBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  activateBtnText: { color: Colors.white, fontSize: Fonts.sizes.md, fontWeight: '700' },
});
