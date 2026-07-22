import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { getImageUrl } from '../../src/constants/api';
import api from '../../src/services/api';
import { Colors, Fonts, Radius, Spacing } from '../../src/constants/theme';
import SubscriptionBanner from '../../src/components/subscription/SubscriptionBanner';
import SubscriptionGate from '../../src/components/subscription/SubscriptionGate';
import ExtraPropertyPaymentModal from '../../src/components/subscription/ExtraPropertyPaymentModal';
import RoleBadge from '../../src/components/RoleBadge';

interface Property {
  id: string;
  title: string;
  slug: string;
  status: string;
  approval_status?: string;
  rejection_reason?: string | null;
  price: number;
  currency: string;
  operation: string;
  views_count: number;
  property_images: { id: string; url: string; is_main: boolean }[];
  zones?: { name: string; city: string };
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  area_m2?: number;
  whatsapp?: string;
  users?: { phone?: string };
  pending_payment?: { id: string; status: string } | null;
}

const opLabel = (op: string) => {
  if (op === 'sale') return 'Venta';
  if (op === 'rent') return 'Alquiler';
  return 'Anticrético';
};

const opColor = (op: string) => {
  if (op === 'sale') return '#F59E0B';
  if (op === 'rent') return '#EF4444';
  return '#22C55E';
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Borrador', color: '#6B7280', bg: '#F3F4F6' },
  pending: { label: 'Pendiente', color: '#D97706', bg: '#FEF3C7' },
  pending_approval: { label: 'En revisión', color: '#D97706', bg: '#FEF3C7' },
  published: { label: 'Publicada', color: '#059669', bg: '#D1FAE5' },
  rejected: { label: 'Rechazada', color: '#DC2626', bg: '#FEE2E2' },
  sold: { label: 'Vendida', color: '#7C3AED', bg: '#EDE9FE' },
  rented: { label: 'Alquilada', color: '#7C3AED', bg: '#EDE9FE' },
  paused: { label: 'Pausada', color: '#6B7280', bg: '#F3F4F6' },
};

const formatPrice = (p: number, c: string) =>
  c === 'USD' ? `$${p.toLocaleString()}` : `Bs. ${p.toLocaleString()}`;

// En escritorio la lista pasa a grid; en móvil sigue siendo una sola columna
const { width: SCREEN_W } = Dimensions.get('window');
const IS_DESKTOP = SCREEN_W >= 768;
const NUM_COLUMNS = IS_DESKTOP ? (SCREEN_W >= 1300 ? 3 : 2) : 1;
const GRID_MAX_WIDTH = IS_DESKTOP ? (NUM_COLUMNS === 3 ? 1180 : 820) : 760;

const getImage = (imgs: Property['property_images']) => {
  if (!imgs?.length) return null;
  return getImageUrl((imgs.find((i) => i.is_main) ?? imgs[0]).url);
};

export default function SavedOrMyPropertiesScreen() {
  const { user, isAuthenticated } = useAuth();
  const isOwner = user?.active_role === 'owner';

  if (isOwner && isAuthenticated) {
    return <OwnerView />;
  }
  return <BuyerView />;
}

/* ─── BUYER: Guardados ─── */
function BuyerView() {
  const router = useRouter();
  const { favorites, isFavorite, toggleFavorite, refreshFavorites } = useFavorites();
  const { isAuthenticated } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSaved = useCallback(async () => {
    if (!isAuthenticated || !favorites.length) {
      setProperties([]);
      return;
    }
    try {
      const { data } = await api.get('/favorites');
      setProperties(
        (data ?? []).map((p: any) => ({
          ...p,
          price: Number(p.price),
          property_images: p.image
            ? [{ id: '0', url: p.image, is_main: true }]
            : [],
          zones: p.zone ? { name: p.zone, city: '' } : undefined,
          operation: p.operation,
        })),
      );
    } catch {}
  }, [isAuthenticated, favorites]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshFavorites();
    await fetchSaved();
    setRefreshing(false);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Guardados</Text>
        <View style={styles.empty}>
          <Ionicons name="log-in-outline" size={64} color={Colors.gray[300]} />
          <Text style={styles.emptyTitle}>Inicia sesión</Text>
          <Text style={styles.emptyText}>
            Inicia sesión para guardar y ver tus propiedades favoritas
          </Text>
        </View>
      </View>
    );
  }

  if (!favorites.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Guardados</Text>
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={64} color={Colors.gray[300]} />
          <Text style={styles.emptyTitle}>Aún no guardaste nada</Text>
          <Text style={styles.emptyText}>
            Toca el corazón en una propiedad para guardarla aquí
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        Guardados <Text style={styles.headerCount}>({favorites.length})</Text>
      </Text>
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => {
          const img = getImage(item.property_images);
          const phone = item.whatsapp ?? item.users?.phone;
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => router.push(`/property/${item.slug}`)}
            >
              {img ? (
                <Image source={{ uri: img }} style={styles.cardImg} />
              ) : (
                <View style={[styles.cardImg, styles.noImg]}>
                  <Ionicons name="image-outline" size={28} color={Colors.gray[300]} />
                </View>
              )}
              <View style={styles.cardContent}>
                <View style={styles.cardRow}>
                  <View style={[styles.badge, { backgroundColor: opColor(item.operation) }]}>
                    <Text style={styles.badgeText}>{opLabel(item.operation)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleFavorite(item.id)} hitSlop={8}>
                    <Ionicons
                      name={isFavorite(item.id) ? 'heart' : 'heart-outline'}
                      size={22}
                      color="#EF4444"
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {item.zones ? `${item.zones.name}, ${item.zones.city}` : item.address}
                </Text>
                <View style={styles.cardRow}>
                  <Text style={styles.cardPrice}>{formatPrice(item.price, item.currency)}</Text>
                  {phone && (
                    <TouchableOpacity
                      style={styles.waBtn}
                      onPress={() =>
                        Linking.openURL(
                          `https://wa.me/${phone.replace(/\D/g, '')}?text=Hola, me interesa "${item.title}" en DIRECTO`,
                        )
                      }
                    >
                      <Ionicons name="logo-whatsapp" size={16} color={Colors.white} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

/* ─── OWNER: Mis Propiedades ─── */
function OwnerView() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSubGate, setShowSubGate] = useState(false);
  const [subGateReason, setSubGateReason] = useState<'no_subscription' | 'limit_reached'>('no_subscription');
  const [extraCharge, setExtraCharge] = useState<{ id: string; title: string; amount?: number; currency?: string; paymentId?: string } | null>(null);

  const openPendingPayment = useCallback((prop: Property) => {
    if (!prop.pending_payment) return;
    setExtraCharge({ id: prop.id, title: prop.title, paymentId: prop.pending_payment.id });
  }, []);

  const fetchMine = useCallback(async () => {
    try {
      const { data } = await api.get('/properties/mine');
      const parsed = (data.data ?? data ?? []).map((p: any) => ({
        ...p,
        price: Number(p.price),
        views_count: Number(p.views_count ?? 0),
      }));
      setProperties(parsed);
    } catch {}
    setLoading(false);
  }, []);

  // Alert.alert no muestra botones en react-native-web: en web se usa window.confirm.
  const confirmAction = useCallback((title: string, message: string, confirmText: string, destructive: boolean, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) onConfirm();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
  }, []);

  const notify = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  }, []);

  const toggleVisibility = useCallback((prop: Property) => {
    const isPublished = prop.status === 'published';
    const isDraft = prop.status === 'draft';
    const action = isPublished ? 'unpublish' : 'publish';
    const label = isPublished ? 'ocultar' : isDraft ? 'publicar' : 'republicar';

    confirmAction(
      isPublished ? 'Ocultar propiedad' : isDraft ? 'Publicar propiedad' : 'Republicar propiedad',
      `¿Deseas ${label} "${prop.title}"?`,
      isPublished ? 'Ocultar' : isDraft ? 'Publicar' : 'Republicar',
      isPublished,
      async () => {
        try {
          const { data } = await api.patch(`/properties/${prop.id}/${action}`);
          // Si intentábamos mostrarla y quedó pausada, puede ser el límite del plan.
          if (!isPublished && data.status === 'paused') {
            try {
              const { data: elig } = await api.get(`/properties/${prop.id}/extra-charge-eligibility`);
              if (elig.eligible) {
                setExtraCharge({
                  id: prop.id,
                  title: prop.title,
                  amount: elig.amount,
                  currency: elig.currency,
                  paymentId: elig.pending ? elig.paymentId : undefined,
                });
              }
            } catch {}
          }
          fetchMine();
        } catch (e: any) {
          const msg = e.response?.data?.message;
          const msgStr = typeof msg === 'string' ? msg : '';
          if (e.response?.status === 403 && (msgStr.includes('suscripción') || msgStr.includes('subscription'))) {
            setSubGateReason(msgStr.includes('límite') || msgStr.includes('limit') ? 'limit_reached' : 'no_subscription');
            setShowSubGate(true);
          } else {
            notify('Error', msgStr || `No se pudo ${label}`);
          }
        }
      },
    );
  }, [fetchMine, confirmAction, notify]);

  const resubmit = useCallback((prop: Property) => {
    confirmAction(
      'Reenviar para aprobación',
      `¿Deseas reenviar "${prop.title}" para revisión? Asegúrate de haber corregido lo indicado en el motivo de rechazo.`,
      'Reenviar',
      false,
      async () => {
        try {
          await api.patch(`/properties/${prop.id}/publish`);
          fetchMine();
          notify('Enviado', 'Tu propiedad fue reenviada para revisión.');
        } catch (e: any) {
          const msg = e.response?.data?.message;
          notify('Error', typeof msg === 'string' ? msg : 'No se pudo reenviar');
        }
      },
    );
  }, [fetchMine, confirmAction, notify]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  useFocusEffect(
    useCallback(() => {
      fetchMine();
    }, [fetchMine]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMine();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const published = properties.filter((p) => p.status === 'published').length;
  const totalViews = properties.reduce((s, p) => s + p.views_count, 0);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>Mis Propiedades</Text>
          <RoleBadge />
        </View>
        {properties.length > 0 && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/create-property')}
          >
            <Ionicons name="add" size={20} color={Colors.white} />
            <Text style={styles.addBtnText}>Publicar propiedad</Text>
          </TouchableOpacity>
        )}
      </View>

      <SubscriptionBanner />

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{properties.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: '#059669' }]}>{published}</Text>
          <Text style={styles.statLabel}>Publicadas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: Colors.primary }]}>{totalViews}</Text>
          <Text style={styles.statLabel}>Visitas</Text>
        </View>
      </View>

      {properties.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="home-outline" size={64} color={Colors.gray[300]} />
          <Text style={styles.emptyTitle}>Aún no tienes propiedades</Text>
          <Text style={styles.emptyText}>
            Publica tu primera propiedad para que los interesados te contacten
            directamente por WhatsApp
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/create-property')}
          >
            <Ionicons name="add-circle" size={20} color={Colors.white} />
            <Text style={styles.emptyBtnText}>Publicar mi primera propiedad</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          key={NUM_COLUMNS}
          data={properties}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={NUM_COLUMNS > 1 ? styles.gridRow : undefined}
          contentContainerStyle={styles.ownerListContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => {
            const img = getImage(item.property_images);
            const hasPendingPayment = item.status === 'paused' && !!item.pending_payment;
            const st = hasPendingPayment
              ? (item.pending_payment!.status === 'in_review'
                  ? { label: 'Pago en revisión', color: '#6366F1', bg: '#EEF2FF' }
                  : { label: 'Pago pendiente', color: '#D97706', bg: '#FEF3C7' })
              : (STATUS_MAP[item.status] ?? STATUS_MAP.draft);
            return (
              <TouchableOpacity
                style={styles.ownerCard}
                activeOpacity={0.9}
                onPress={() => router.push(`/property/${item.slug}`)}
              >
                <View style={styles.ownerCardImgWrap}>
                  {img ? (
                    <Image source={{ uri: img }} style={styles.ownerCardImg} />
                  ) : (
                    <View style={[styles.ownerCardImg, styles.ownerNoImg]}>
                      <Ionicons name="image-outline" size={32} color={Colors.gray[300]} />
                    </View>
                  )}
                  <View style={[styles.ownerBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.ownerBadgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                  <View style={styles.viewsPill}>
                    <Ionicons name="eye-outline" size={12} color={Colors.white} />
                    <Text style={styles.viewsPillText}>{item.views_count}</Text>
                  </View>
                </View>
                <View style={styles.ownerCardContent}>
                  <Text style={styles.ownerCardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.ownerCardSub} numberOfLines={1}>
                    {item.zones ? `${item.zones.name}, ${item.zones.city}` : ''}
                  </Text>
                  <Text style={styles.ownerCardPrice}>{formatPrice(item.price, item.currency)}</Text>
                  {item.status === 'rejected' && item.rejection_reason && (
                    <View style={styles.rejectBanner}>
                      <Ionicons name="alert-circle" size={14} color="#DC2626" />
                      <Text style={styles.rejectText} numberOfLines={2}>{item.rejection_reason}</Text>
                    </View>
                  )}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => router.push(`/edit-property?id=${item.id}`)}
                      hitSlop={4}
                    >
                      <Ionicons name="create-outline" size={16} color={Colors.primary} />
                      <Text style={styles.actionBtnText}>Editar</Text>
                    </TouchableOpacity>
                    {item.status === 'rejected' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#D1FAE5' }]}
                        onPress={() => resubmit(item)}
                        hitSlop={4}
                      >
                        <Ionicons name="refresh" size={16} color="#059669" />
                        <Text style={[styles.actionBtnText, { color: '#059669' }]}>Reenviar</Text>
                      </TouchableOpacity>
                    )}
                    {hasPendingPayment ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#EEF2FF' }]}
                        onPress={() => openPendingPayment(item)}
                        hitSlop={4}
                      >
                        <Ionicons name="time-outline" size={16} color="#6366F1" />
                        <Text style={[styles.actionBtnText, { color: '#6366F1' }]}>Ver pago</Text>
                      </TouchableOpacity>
                    ) : (item.status === 'published' || item.status === 'paused' || item.status === 'draft') && (
                      <TouchableOpacity
                        style={[styles.actionBtn, item.status === 'published' && styles.actionBtnDanger]}
                        onPress={() => toggleVisibility(item)}
                        hitSlop={4}
                      >
                        <Ionicons
                          name={item.status === 'published' ? 'eye-off-outline' : 'eye-outline'}
                          size={16}
                          color={item.status === 'published' ? '#DC2626' : Colors.success}
                        />
                        <Text style={[styles.actionBtnText, item.status === 'published' ? { color: '#DC2626' } : { color: Colors.success }]}>
                          {item.status === 'published' ? 'Ocultar' : item.status === 'draft' ? 'Publicar' : 'Mostrar'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
      <SubscriptionGate
        visible={showSubGate}
        onClose={() => setShowSubGate(false)}
        reason={subGateReason}
      />
      <ExtraPropertyPaymentModal
        visible={!!extraCharge}
        propertyId={extraCharge?.id ?? null}
        propertyTitle={extraCharge?.title}
        amount={extraCharge?.amount}
        currency={extraCharge?.currency}
        resumePaymentId={extraCharge?.paymentId ?? null}
        onClose={() => setExtraCharge(null)}
        onPaid={fetchMine}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingTop: 60 },
  center: { justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
    width: '100%',
    maxWidth: GRID_MAX_WIDTH,
    alignSelf: 'center',
  },
  header: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: Spacing.xs,
  },
  headerCount: { color: Colors.gray[400], fontWeight: '400' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    cursor: 'pointer' as any,
  },
  addBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.sm },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  emptyTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    color: Colors.gray[700],
    marginTop: Spacing.lg,
  },
  emptyText: {
    fontSize: Fonts.sizes.md,
    color: Colors.gray[400],
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    marginTop: Spacing.xl,
    cursor: 'pointer' as any,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.md },
  // maxWidth + centrado: en móvil no afecta (pantalla más angosta),
  // en web evita que las tarjetas se estiren en monitores grandes
  listContent: { padding: Spacing.lg, gap: Spacing.md, width: '100%', maxWidth: 760, alignSelf: 'center' },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: Colors.gray[100],
  },
  cardImg: { width: 110, height: 120 },
  noImg: { backgroundColor: Colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1, padding: Spacing.md, justifyContent: 'space-between' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  cardTitle: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.gray[800] },
  cardSub: { fontSize: Fonts.sizes.xs, color: Colors.gray[500] },
  cardPrice: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  waBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewsText: { fontSize: Fonts.sizes.xs, color: Colors.gray[400] },

  // ── Owner grid (Mis Propiedades) — namespace propio para no chocar con
  // el layout de tarjeta horizontal de Guardados ──
  ownerListContent: { padding: Spacing.lg, gap: Spacing.md, width: '100%', maxWidth: GRID_MAX_WIDTH, alignSelf: 'center' },
  gridRow: { gap: Spacing.md },
  ownerCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: Colors.gray[100],
    marginBottom: NUM_COLUMNS > 1 ? 0 : Spacing.md,
  },
  ownerCardImgWrap: { position: 'relative', width: '100%', aspectRatio: 16 / 10 },
  ownerCardImg: { width: '100%', height: '100%' },
  ownerNoImg: { backgroundColor: Colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  ownerCardContent: { padding: Spacing.md },
  ownerBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ownerBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  ownerCardTitle: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.gray[800] },
  ownerCardSub: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginTop: 2 },
  ownerCardPrice: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900], marginTop: 4 },
  viewsPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  viewsPillText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    width: '100%',
    maxWidth: GRID_MAX_WIDTH,
    alignSelf: 'center',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.gray[50],
    borderRadius: Radius.md,
  },
  statNum: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.gray[900] },
  statLabel: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
  },
  actionBtnDanger: { backgroundColor: '#FEE2E2' },
  actionBtnText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  rejectBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    padding: 6,
    gap: 4,
    marginTop: 2,
  },
  rejectText: {
    flex: 1,
    fontSize: 10,
    color: '#991B1B',
    lineHeight: 14,
  },
});
