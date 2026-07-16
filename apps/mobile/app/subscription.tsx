import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';
import { useSubscription, Plan } from '../src/context/SubscriptionContext';
import api from '../src/services/api';

interface Subscription {
  id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  property_count: number | null;
  subscription_plans: Plan;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: '#22C55E' },
  expired: { label: 'Vencida', color: '#EF4444' },
  pending_payment: { label: 'Pendiente de pago', color: '#F59E0B' },
  in_review: { label: 'Renovación pendiente', color: '#6366F1' },
  cancelled: { label: 'Cancelada', color: Colors.gray[500] },
};

const notice = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

/** Precio total local: base + extras (misma fórmula que el backend). */
const priceFor = (plan: Plan, count: number) => {
  const extra = Math.max(0, count - plan.included_properties) * Number(plan.extra_property_price ?? 0);
  return Number(plan.price) + extra;
};

const fmtMoney = (n: number, c: string) =>
  `${c === 'USD' ? '$' : 'Bs.'} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function SubscriptionScreen() {
  const router = useRouter();
  const { refresh: refreshSubContext } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [freeTrialUsed, setFreeTrialUsed] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  // Cantidad de propiedades elegida por plan (plan.id -> count)
  const [counts, setCounts] = useState<Record<string, number>>({});

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
      setCounts((prev) => {
        const next = { ...prev };
        for (const p of plansRes.data as Plan[]) {
          if (!next[p.id]) next[p.id] = p.included_properties ?? 1;
        }
        return next;
      });
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isActive = subscription?.status === 'active';
  const statusInfo = STATUS_LABELS[subscription?.status ?? ''] ?? { label: 'Sin suscripción', color: Colors.gray[400] };
  const currentIsFree = Number(subscription?.subscription_plans?.price ?? 1) === 0;

  const setCount = (planId: string, delta: number, included: number) => {
    setCounts((prev) => ({
      ...prev,
      [planId]: Math.min(100, Math.max(included, (prev[planId] ?? included) + delta)),
    }));
  };

  const handleActivate = async (plan: Plan) => {
    const isFree = Number(plan.price) === 0;
    try {
      setActivating(plan.id);
      const { data } = await api.post('/subscriptions/activate', {
        plan_id: plan.id,
        property_count: isFree ? undefined : (counts[plan.id] ?? plan.included_properties),
      });
      refreshSubContext();
      if (data.status === 'pending_payment') {
        notice('Pendiente de pago', 'Realiza el pago por QR para activar tu suscripción.');
        load();
      } else if (isFree) {
        // Plan gratis activado: directo a publicar la primera propiedad
        router.replace('/create-property');
        return;
      } else {
        notice('Suscripción activada', 'Ya puedes publicar propiedades.');
        load();
      }
    } catch (e: any) {
      notice('Error', e.response?.data?.message ?? 'No se pudo contratar');
    } finally {
      setActivating(null);
    }
  };

  const handleRenew = async () => {
    try {
      setActivating('renew');
      const { data } = await api.post('/subscriptions/renew', {});
      if (data.status === 'in_review') {
        notice(
          'Renovación creada',
          'Realiza el pago por QR para confirmarla. Tu plan actual sigue activo y los días se sumarán al confirmarse.',
        );
      } else if (data.status === 'pending_payment') {
        notice('Pendiente de pago', 'Realiza el pago por QR para reactivar tu suscripción.');
      }
      load();
      refreshSubContext();
    } catch (e: any) {
      notice('Error', e.response?.data?.message ?? 'No se pudo renovar');
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
                    {subscription.property_count ?? subscription.subscription_plans?.included_properties ?? 1}
                  </Text>
                </View>
              </View>
            )}

            {subscription.status === 'in_review' && (
              <View style={styles.renewPendingNote}>
                <Ionicons name="time-outline" size={16} color="#6366F1" />
                <Text style={styles.renewPendingText}>
                  Tienes una renovación esperando confirmación de pago.
                </Text>
              </View>
            )}

            {/* Renovar: solo planes de pago (el gratis es de un solo uso) */}
            {!currentIsFree && (subscription.status === 'expired' || subscription.status === 'active') && (
              <TouchableOpacity
                style={styles.renewBtn}
                onPress={handleRenew}
                disabled={activating === 'renew'}
              >
                <Ionicons name="refresh" size={18} color={Colors.white} />
                <Text style={styles.renewBtnText}>
                  {activating === 'renew' ? 'Procesando...' : 'Renovar suscripción'}
                </Text>
              </TouchableOpacity>
            )}

            {isActive && subscription.subscription_plans?.is_business && (
              <TouchableOpacity
                style={[styles.renewBtn, { backgroundColor: '#0EA5E9', marginTop: Spacing.md }]}
                onPress={() => router.push('/company')}
              >
                <Ionicons name="megaphone" size={18} color={Colors.white} />
                <Text style={styles.renewBtnText}>Gestionar mi empresa y publicidad</Text>
              </TouchableOpacity>
            )}

            {currentIsFree && subscription.status === 'expired' && (
              <View style={styles.freeEndedNote}>
                <Ionicons name="information-circle" size={18} color="#B45309" />
                <Text style={styles.freeEndedText}>
                  Tu plan gratis terminó. Elige un plan de pago para seguir publicando.
                </Text>
              </View>
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

        {/* Plans */}
        <Text style={styles.sectionTitle}>Planes disponibles</Text>
        {plans.map((plan) => {
          const isFree = Number(plan.price) === 0;
          const isCurrent = subscription?.subscription_plans?.id === plan.id && isActive;
          const freeBlocked = isFree && freeTrialUsed;
          const count = counts[plan.id] ?? plan.included_properties ?? 1;
          const total = priceFor(plan, count);
          const extraCount = Math.max(0, count - plan.included_properties);

          return (
            <View key={plan.id} style={[styles.planCard, isCurrent && styles.planCardCurrent, freeBlocked && styles.planCardDisabled]}>
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
                  {total === 0 ? 'Gratis' : fmtMoney(total, plan.currency)}
                </Text>
                <Text style={styles.planDuration}>/ {plan.duration_days} días</Text>
              </View>

              <View style={styles.planFeatures}>
                {plan.is_business ? (
                  <>
                    <View style={styles.featureRow}>
                      <Ionicons name="megaphone" size={16} color="#0EA5E9" />
                      <Text style={styles.featureText}>
                        {plan.ad_views.toLocaleString()} vistas de publicidad
                      </Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.featureText}>Popup de entrada en app y web</Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.featureText}>Anuncios en detalles de propiedades</Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.featureText}>Links externos a tu sitio</Text>
                    </View>
                  </>
                ) : (
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.featureText}>
                    {isFree
                      ? '1 propiedad por 30 días (un solo uso)'
                      : `${plan.included_properties} propiedad(es) incluidas`}
                  </Text>
                </View>
                )}
                {!isFree && Number(plan.extra_property_price) > 0 && (
                  <View style={styles.featureRow}>
                    <Ionicons name="add-circle-outline" size={16} color={Colors.gray[500]} />
                    <Text style={styles.featureText}>
                      Extra: {fmtMoney(Number(plan.extra_property_price), plan.currency)} c/u
                    </Text>
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
                {!plan.is_business && (
                  <>
                    <View style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.featureText}>Hasta 10 fotos por propiedad</Text>
                    </View>
                    <View style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.featureText}>Contacto directo por WhatsApp</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Selector de cantidad de propiedades (solo planes de pago) */}
              {!isFree && !isCurrent && Number(plan.extra_property_price) > 0 && (
                <View style={styles.countRow}>
                  <Text style={styles.countLabel}>¿Cuántas propiedades?</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={[styles.stepBtn, count <= plan.included_properties && styles.stepBtnOff]}
                      onPress={() => setCount(plan.id, -1, plan.included_properties)}
                      disabled={count <= plan.included_properties}
                    >
                      <Ionicons name="remove" size={18} color={Colors.gray[700]} />
                    </TouchableOpacity>
                    <Text style={styles.countValue}>{count}</Text>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setCount(plan.id, 1, plan.included_properties)}>
                      <Ionicons name="add" size={18} color={Colors.gray[700]} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {extraCount > 0 && !isCurrent && (
                <Text style={styles.extraNote}>
                  {plan.included_properties} incluidas + {extraCount} extra ={' '}
                  {fmtMoney(total, plan.currency)}
                </Text>
              )}

              {freeBlocked ? (
                <View style={styles.freeUsedBox}>
                  <Ionicons name="lock-closed" size={16} color={Colors.gray[400]} />
                  <Text style={styles.freeUsedText}>Ya usaste tu plan gratis</Text>
                </View>
              ) : !isCurrent ? (
                <TouchableOpacity
                  style={[styles.activateBtn, isFree && styles.activateBtnFree]}
                  onPress={() => handleActivate(plan)}
                  disabled={activating === plan.id}
                >
                  <Text style={styles.activateBtnText}>
                    {activating === plan.id
                      ? 'Contratando...'
                      : isFree
                        ? '¡Publicar GRATIS ahora!'
                        : 'Contratar plan'}
                  </Text>
                </TouchableOpacity>
              ) : null}
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
  content: { padding: Spacing.xxl, paddingBottom: 60, width: '100%', maxWidth: 640, alignSelf: 'center' },

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
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full, marginTop: Spacing.xs, alignSelf: 'flex-start' },
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
  renewPendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  renewPendingText: { flex: 1, fontSize: Fonts.sizes.sm, color: '#4338CA', fontWeight: '500' },
  freeEndedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  freeEndedText: { flex: 1, fontSize: Fonts.sizes.sm, color: '#92400E', fontWeight: '600' },

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
  planCardDisabled: { opacity: 0.65 },
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

  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    backgroundColor: Colors.gray[50],
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  countLabel: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[700] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnOff: { opacity: 0.4 },
  countValue: { fontSize: Fonts.sizes.lg, fontWeight: '800', color: Colors.gray[900], minWidth: 28, textAlign: 'center' },
  extraNote: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginTop: Spacing.sm },

  freeUsedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.gray[100],
    paddingVertical: 14,
    borderRadius: Radius.lg,
    marginTop: Spacing.lg,
  },
  freeUsedText: { color: Colors.gray[500], fontSize: Fonts.sizes.md, fontWeight: '600' },

  activateBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  activateBtnFree: { backgroundColor: '#22C55E' },
  activateBtnText: { color: Colors.white, fontSize: Fonts.sizes.md, fontWeight: '700' },
});
