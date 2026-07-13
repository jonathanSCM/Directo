import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';
import { Colors, Fonts, Radius, Spacing } from '../../src/constants/theme';

interface MyProperty {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: number;
  currency: string;
  operation: string;
  views_count: number;
  property_images: { id: string; url: string; is_main: boolean }[];
  zones?: { name: string; city: string };
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Borrador', color: '#6B7280', bg: '#F3F4F6' },
  pending: { label: 'Pendiente', color: '#D97706', bg: '#FEF3C7' },
  published: { label: 'Publicada', color: '#059669', bg: '#D1FAE5' },
  rejected: { label: 'Rechazada', color: '#DC2626', bg: '#FEE2E2' },
  sold: { label: 'Vendida', color: '#7C3AED', bg: '#EDE9FE' },
  rented: { label: 'Alquilada', color: '#7C3AED', bg: '#EDE9FE' },
  paused: { label: 'Pausada', color: '#6B7280', bg: '#F3F4F6' },
};

const formatPrice = (p: number, c: string) =>
  c === 'USD' ? `$${p.toLocaleString()}` : `Bs. ${p.toLocaleString()}`;

export default function MyPropertiesScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [properties, setProperties] = useState<MyProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isOwner = user?.active_role === 'owner';

  const fetchMine = useCallback(async () => {
    if (!isAuthenticated || !isOwner) {
      setProperties([]);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/properties/mine');
      const parsed = (data.data ?? data ?? []).map((p: any) => ({
        ...p,
        price: Number(p.price),
        views_count: Number(p.views_count ?? 0),
      }));
      setProperties(parsed);
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isOwner]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMine();
    setRefreshing(false);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Mis Propiedades</Text>
        <View style={styles.empty}>
          <Ionicons name="home-outline" size={64} color={Colors.gray[300]} />
          <Text style={styles.emptyTitle}>Inicia sesión</Text>
          <Text style={styles.emptyText}>
            Necesitas una cuenta para publicar y administrar propiedades
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.loginBtnText}>Iniciar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Mis Propiedades</Text>
        <View style={styles.empty}>
          <Ionicons name="business-outline" size={64} color={Colors.gray[300]} />
          <Text style={styles.emptyTitle}>Modo Comprador</Text>
          <Text style={styles.emptyText}>
            Cambia a modo Propietario desde tu perfil para ver y administrar tus
            propiedades
          </Text>
        </View>
      </View>
    );
  }

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
          <Text style={[styles.statNum, { color: Colors.primary }]}>
            {totalViews}
          </Text>
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
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => {
            const img = item.property_images?.length
              ? (
                  item.property_images.find((i) => i.is_main) ??
                  item.property_images[0]
                ).url
              : null;
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
                    <Ionicons
                      name="image-outline"
                      size={28}
                      color={Colors.gray[300]}
                    />
                  </View>
                )}
                <View style={styles.cardContent}>
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: st.bg },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: st.color }]}>
                        {st.label}
                      </Text>
                    </View>
                    <View style={styles.viewsRow}>
                      <Ionicons
                        name="eye-outline"
                        size={14}
                        color={Colors.gray[400]}
                      />
                      <Text style={styles.viewsText}>{item.views_count}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardLocation} numberOfLines={1}>
                    {item.zones
                      ? `${item.zones.name}, ${item.zones.city}`
                      : ''}
                  </Text>
                  <Text style={styles.cardPrice}>
                    {formatPrice(item.price, item.currency)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
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
  statNum: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: '800',
    color: Colors.gray[900],
  },
  statLabel: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginTop: 2 },
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
  loginBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    marginTop: Spacing.xxl,
  },
  loginBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: Fonts.sizes.md,
  },
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
  noImg: {
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewsText: { fontSize: Fonts.sizes.xs, color: Colors.gray[400] },
  cardTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.gray[800],
  },
  cardLocation: { fontSize: Fonts.sizes.xs, color: Colors.gray[500] },
  cardPrice: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
});
