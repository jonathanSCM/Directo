import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSubscription } from '../../context/SubscriptionContext';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  reason?: 'no_subscription' | 'limit_reached';
}

export default function SubscriptionGate({ visible, onClose, reason = 'no_subscription' }: Props) {
  const { plans, freeTrialUsed } = useSubscription();
  const router = useRouter();

  const goToSub = () => {
    onClose();
    setTimeout(() => router.push('/subscription'), 200);
  };

  const sortedPlans = [...plans].sort((a, b) => Number(a.price) - Number(b.price));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={reason === 'limit_reached' ? 'alert-circle' : 'lock-closed'}
              size={36}
              color="#7C3AED"
            />
          </View>

          <Text style={styles.title}>
            {reason === 'limit_reached'
              ? 'Límite de propiedades alcanzado'
              : 'Suscripción requerida'}
          </Text>
          <Text style={styles.subtitle}>
            {reason === 'limit_reached'
              ? 'Tu plan actual no permite más propiedades activas. Mejora tu plan para publicar más.'
              : 'Necesitas una suscripción activa para publicar propiedades en DIRECTO.'}
          </Text>

          {sortedPlans.length > 0 && (
            <View style={styles.plansCompare}>
              <Text style={styles.compareTitle}>Compara los planes:</Text>
              {sortedPlans.map((plan) => {
                const price = Number(plan.price);
                return (
                  <View key={plan.id} style={styles.planRow}>
                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <Text style={styles.planDetail}>
                        {plan.included_properties} prop. incluidas
                        {' '}· {plan.duration_days} días
                      </Text>
                    </View>
                    <Text style={styles.planPrice}>
                      {price === 0
                        ? 'Gratis'
                        : `${plan.currency === 'USD' ? '$' : 'Bs.'} ${price.toLocaleString()}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {!freeTrialUsed && (
            <View style={styles.trialHint}>
              <Ionicons name="gift" size={16} color="#F59E0B" />
              <Text style={styles.trialText}>
                ¡Tienes una prueba gratuita de 30 días disponible!
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.ctaBtn} onPress={goToSub} activeOpacity={0.8}>
            <Ionicons name="rocket" size={18} color={Colors.white} />
            <Text style={styles.ctaText}>Ver planes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '800',
    color: Colors.gray[900],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Fonts.sizes.sm,
    color: Colors.gray[500],
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  plansCompare: {
    width: '100%',
    marginTop: Spacing.xl,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  compareTitle: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
    color: Colors.gray[500],
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  planInfo: { flex: 1 },
  planName: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.gray[800] },
  planDetail: { fontSize: Fonts.sizes.xs, color: Colors.gray[400], marginTop: 1 },
  planPrice: { fontSize: Fonts.sizes.md, fontWeight: '700', color: '#7C3AED' },

  trialHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  trialText: { fontSize: Fonts.sizes.sm, color: '#92400E', fontWeight: '600', flex: 1 },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    borderRadius: Radius.lg,
    marginTop: Spacing.xl,
  },
  ctaText: { color: Colors.white, fontSize: Fonts.sizes.md, fontWeight: '700' },
  closeBtn: { marginTop: Spacing.md, paddingVertical: 8 },
  closeText: { fontSize: Fonts.sizes.sm, color: Colors.gray[400] },
});
