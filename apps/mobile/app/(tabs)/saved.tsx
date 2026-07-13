import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
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

  const toggleVisibility = useCallback(async (prop: Property) => {
    const isPublished = prop.status === 'published';
    const action = isPublished ? 'unpublish' : 'publish';
    const label = isPublished ? 'ocultar' : 'republicar';

    Alert.alert(
      isPublished ? 'Ocultar propiedad' : 'Republicar propiedad',
      `¿Deseas ${label} "${prop.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: isPublished ? 'Ocultar' : 'Republicar',
          style: isPublished ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await api.patch(`/properties/${prop.id}/${action}`);
              fetchMine();
            } catch (e: any) {
              const msg = e.response?.data?.message;
              const msgStr = typeof msg === 'string' ? msg : '';
              if (e.response?.status === 403 && (msgStr.includes('suscripción') || msgStr.includes('subscription'))) {
                setSubGateReason(msgStr.includes('límite') || msgStr.includes('limit') ? 'limit_reached' : 'no_subscription');
                setShowSubGate(true);
              } else {
                Alert.alert('Error', msgStr || `No se pudo ${label}`);
              }
            }
          },
        },
      ],
    );
  }, [fetchMine]);

  const resubmit = useCallback(async (prop: Property) => {
    Alert.alert(
      'Reenviar para aprobación',
      `¿Deseas reenviar "${prop.title}" para revisión? Asegúrate de haber corregido lo indicado en el motivo de rechazo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reenviar',
          onPress: async () => {
            try {
              await api.patch(`/properties/${prop.id}/publish`);
              fetchMine();
              Alert.alert('Enviado', 'Tu propiedad fue reenviada para revisión.');
            } catch (e: any) {
              const msg = e.response?.data?.message;
              Alert.alert('Error', typeof msg === 'string' ? msg : 'No se pudo reenviar');
            }
          },
        },
      ],
    );
  }, [fetchMine]);

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
      <Text style={styles.header}>Mis Propiedades</Text>

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
          <Ionicons name="add-circle-outline" size={64} color={Colors.gray[300]} />
          <Text style={styles.emptyTitle}>Sin propiedades</Text>
          <Text style={styles.emptyText}>
            Publica tu primera propiedad y empieza a recibir interesados
          </Text>
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => {
            const img = getImage(item.property_images);
            const st = STATUS_MAP[item.status] ?? STATUS_MAP.draft;
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
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                    </View>
                    <View style={styles.viewsRow}>
                      <Ionicons name="eye-outline" size={14} color={Colors.gray[400]} />
                      <Text style={styles.viewsText}>{item.views_count}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardSub} numberOfLines={1}>
                    {item.zones ? `${item.zones.name}, ${item.zones.city}` : ''}
                  </Text>
                  <Text style={styles.cardPrice}>{formatPrice(item.price, item.currency)}</Text>
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
                    {(item.status === 'published' || item.status === 'paused') && (
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
                          {item.status === 'published' ? 'Ocultar' : 'Mostrar'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingTop: 60 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.gray[900],
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  headerCount: { color: Colors.gray[400], fontWeight: '400' },
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
  listContent: { padding: Spacing.lg, gap: Spacing.md },
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
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
