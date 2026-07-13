import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getImageUrl } from '../src/constants/api';
import api from '../src/services/api';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';

interface PropertyImage {
  id: string;
  url: string;
  is_main: boolean;
}

interface MyProperty {
  id: string;
  title: string;
  slug: string;
  address: string;
  price: number;
  currency: string;
  operation: string;
  status: string;
  approval_status: string;
  rejection_reason: string | null;
  views_count: number;
  property_images?: PropertyImage[];
  property_types?: { name: string };
  zones?: { name: string; city: string };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:            { label: 'Borrador',          color: '#64748B', bg: '#F1F5F9' },
  pending_approval: { label: 'En revisión',        color: '#D97706', bg: '#FEF3C7' },
  published:        { label: 'Publicada',          color: '#16A34A', bg: '#DCFCE7' },
  rejected:         { label: 'Rechazada',          color: '#DC2626', bg: '#FEE2E2' },
  paused:           { label: 'Pausada',            color: '#64748B', bg: '#F1F5F9' },
  sold_rented:      { label: 'Vendida/Alquilada',  color: '#2563EB', bg: '#DBEAFE' },
  taken_down:       { label: 'Dada de baja',       color: '#DC2626', bg: '#FEE2E2' },
};

const OP_LABEL: Record<string, string> = {
  sale: 'Venta',
  rent: 'Alquiler',
  anticretico: 'Anticrético',
};

export default function MyPropertiesScreen() {
  const router = useRouter();
  const [properties, setProperties] = useState<MyProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/properties/mine?limit=50');
      setProperties(data.data ?? data);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar tus propiedades');
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleMarkSold = (prop: MyProperty) => {
    const label = prop.operation === 'rent' ? 'alquilada' : 'vendida';
    Alert.alert(
      `Marcar como ${label}`,
      `¿Confirmas que "${prop.title}" ya fue ${label}? La propiedad dejará de aparecer en los resultados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Sí, fue ${label}`,
          onPress: async () => {
            setActionLoading(prop.id);
            try {
              await api.patch(`/properties/${prop.id}/sold`);
              await load();
            } catch {
              Alert.alert('Error', 'No se pudo actualizar la propiedad');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const handlePublish = async (prop: MyProperty) => {
    setActionLoading(prop.id);
    try {
      await api.patch(`/properties/${prop.id}/publish`);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo publicar');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async (prop: MyProperty) => {
    Alert.alert('Pausar propiedad', '¿Pausar la publicación? Puedes volver a publicarla cuando quieras.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Pausar',
        onPress: async () => {
          setActionLoading(prop.id);
          try {
            await api.patch(`/properties/${prop.id}/unpublish`);
            await load();
          } catch {
            Alert.alert('Error', 'No se pudo pausar');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleReactivate = (prop: MyProperty) => {
    Alert.alert(
      'Republicar propiedad',
      `¿Quieres volver a publicar "${prop.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Republicar',
          onPress: async () => {
            setActionLoading(prop.id);
            try {
              await api.patch(`/properties/${prop.id}/reactivate`);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo republicar');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis propiedades</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/create-property')}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.xxl, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {properties.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={64} color={Colors.gray[300]} />
            <Text style={styles.emptyTitle}>Sin propiedades</Text>
            <Text style={styles.emptyDesc}>Publicá tu primera propiedad y empieza a recibir consultas</Text>
            <TouchableOpacity style={styles.publishBtn} onPress={() => router.push('/create-property')}>
              <Text style={styles.publishBtnText}>Publicar propiedad</Text>
            </TouchableOpacity>
          </View>
        ) : (
          properties.map((prop) => {
            const statusCfg = STATUS_CONFIG[prop.status] ?? { label: prop.status, color: '#64748B', bg: '#F1F5F9' };
            const mainImg = prop.property_images?.find((i) => i.is_main) ?? prop.property_images?.[0];
            const isBusy = actionLoading === prop.id;
            const canPublish = prop.status === 'draft' || prop.status === 'rejected' || prop.status === 'paused';
            const canPause = prop.status === 'published';
            const canMarkSold = prop.status === 'published';
            const isSold = prop.status === 'sold_rented';

            return (
              <View key={prop.id} style={styles.card}>
                {/* Thumbnail + info */}
                <TouchableOpacity
                  style={styles.cardTop}
                  onPress={() => router.push(`/property/${prop.slug}`)}
                  activeOpacity={0.85}
                >
                  {mainImg ? (
                    <Image source={{ uri: getImageUrl(mainImg.url)! }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.noThumb]}>
                      <Ionicons name="image-outline" size={28} color={Colors.gray[300]} />
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{prop.title}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {prop.zones ? `${prop.zones.name}, ${prop.zones.city}` : prop.address}
                    </Text>
                    <Text style={styles.cardPrice}>
                      {prop.currency === 'USD' ? '$' : 'Bs.'} {Number(prop.price).toLocaleString()}
                      {'  '}<Text style={styles.cardOp}>{OP_LABEL[prop.operation] ?? prop.operation}</Text>
                    </Text>
                    <View style={styles.cardMeta}>
                      <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                        <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                      </View>
                      {prop.views_count > 0 && (
                        <View style={styles.viewsRow}>
                          <Ionicons name="eye-outline" size={12} color={Colors.gray[400]} />
                          <Text style={styles.viewsText}>{prop.views_count}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Rejection reason */}
                {prop.rejection_reason && (
                  <View style={styles.rejectBanner}>
                    <Ionicons name="warning-outline" size={14} color="#DC2626" />
                    <Text style={styles.rejectText} numberOfLines={2}>{prop.rejection_reason}</Text>
                  </View>
                )}

                {/* Sold banner + reactivate */}
                {isSold && (
                  <View>
                    <View style={styles.soldBanner}>
                      <Ionicons name="checkmark-circle" size={16} color="#2563EB" />
                      <Text style={styles.soldText}>Marcada como {prop.operation === 'rent' ? 'alquilada' : 'vendida'}</Text>
                    </View>
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.actionPrimary, isBusy && styles.disabled]}
                        onPress={() => !isBusy && handleReactivate(prop)}
                        disabled={isBusy}
                      >
                        {isBusy ? (
                          <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                          <>
                            <Ionicons name="refresh-outline" size={15} color={Colors.white} />
                            <Text style={styles.actionPrimaryText}>Republicar</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Actions */}
                {!isSold && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionEdit}
                      onPress={() => router.push(`/edit-property?id=${prop.id}`)}
                    >
                      <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
                      <Text style={styles.actionEditText}>Editar</Text>
                    </TouchableOpacity>

                    {canPublish && (
                      <TouchableOpacity
                        style={[styles.actionPrimary, isBusy && styles.disabled]}
                        onPress={() => !isBusy && handlePublish(prop)}
                        disabled={isBusy}
                      >
                        {isBusy ? (
                          <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                          <>
                            <Ionicons name="cloud-upload-outline" size={15} color={Colors.white} />
                            <Text style={styles.actionPrimaryText}>Publicar</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}

                    {canPause && (
                      <TouchableOpacity
                        style={[styles.actionSecondary, isBusy && styles.disabled]}
                        onPress={() => !isBusy && handlePause(prop)}
                        disabled={isBusy}
                      >
                        <Ionicons name="pause-outline" size={15} color={Colors.gray[600]} />
                        <Text style={styles.actionSecondaryText}>Pausar</Text>
                      </TouchableOpacity>
                    )}

                    {canMarkSold && (
                      <TouchableOpacity
                        style={[styles.actionSold, isBusy && styles.disabled]}
                        onPress={() => !isBusy && handleMarkSold(prop)}
                        disabled={isBusy}
                      >
                        {isBusy ? (
                          <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle-outline" size={15} color={Colors.white} />
                            <Text style={styles.actionPrimaryText}>
                              {prop.operation === 'rent' ? 'Alquilada' : 'Vendida'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900], textAlign: 'center' },
  addBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-end' },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[700], marginTop: Spacing.lg },
  emptyDesc: { fontSize: Fonts.sizes.md, color: Colors.gray[400], textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22, paddingHorizontal: 32 },
  publishBtn: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: Radius.full, marginTop: 24 },
  publishBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.md },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.md },
  thumb: { width: 88, height: 88, borderRadius: Radius.md },
  noThumb: { backgroundColor: Colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.gray[900], lineHeight: 20 },
  cardSub: { fontSize: Fonts.sizes.xs, color: Colors.gray[400], marginTop: 3 },
  cardPrice: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.primary, marginTop: 6 },
  cardOp: { fontSize: Fonts.sizes.xs, fontWeight: '500', color: Colors.gray[500] },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontSize: Fonts.sizes.xs, fontWeight: '600' },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewsText: { fontSize: Fonts.sizes.xs, color: Colors.gray[400] },

  rejectBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#FEE2E2',
    borderRadius: Radius.sm,
  },
  rejectText: { flex: 1, fontSize: Fonts.sizes.xs, color: '#991B1B', lineHeight: 17 },

  soldBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: '#DBEAFE',
    borderRadius: Radius.sm,
  },
  soldText: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: '#1D4ED8' },

  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  actionEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  actionEditText: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.primary },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
  },
  actionPrimaryText: { fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.white },
  actionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.gray[100],
  },
  actionSecondaryText: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.gray[600] },
  actionSold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: '#16A34A',
  },
  disabled: { opacity: 0.5 },
});
