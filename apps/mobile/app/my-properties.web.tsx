import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getImageUrl } from '../src/constants/api';
import api from '../src/services/api';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';

interface PropertyImage { id: string; url: string; is_main: boolean; }
interface MyProperty {
  id: string; title: string; slug: string; address: string;
  price: number; currency: string; operation: string;
  status: string; approval_status: string; rejection_reason: string | null;
  views_count: number;
  property_images?: PropertyImage[];
  property_types?: { name: string };
  zones?: { name: string; city: string };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:            { label: 'Borrador',         color: '#64748B', bg: '#F1F5F9' },
  pending_approval: { label: 'En revisión',       color: '#D97706', bg: '#FEF3C7' },
  published:        { label: 'Publicada',         color: '#16A34A', bg: '#DCFCE7' },
  rejected:         { label: 'Rechazada',         color: '#DC2626', bg: '#FEE2E2' },
  paused:           { label: 'Pausada',           color: '#64748B', bg: '#F1F5F9' },
  sold_rented:      { label: 'Vendida/Alquilada', color: '#2563EB', bg: '#DBEAFE' },
  taken_down:       { label: 'Dada de baja',      color: '#DC2626', bg: '#FEE2E2' },
};
const OP_LABEL: Record<string, string> = {
  sale: 'Venta', rent: 'Alquiler', anticretico: 'Anticrético',
};

// ── Inline confirmation dialog ────────────────────────────────────────────────
function ConfirmDialog({
  title, message, confirmLabel, confirmColor = Colors.primary,
  onConfirm, onCancel, loading,
}: {
  title: string; message: string; confirmLabel: string;
  confirmColor?: string; onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <View style={dlg.backdrop}>
      <View style={dlg.box}>
        <Text style={dlg.title}>{title}</Text>
        <Text style={dlg.msg}>{message}</Text>
        <View style={dlg.row}>
          <TouchableOpacity style={dlg.cancel} onPress={onCancel} disabled={loading}>
            <Text style={dlg.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[dlg.confirm, { backgroundColor: confirmColor }, loading && { opacity: 0.6 }]}
            onPress={onConfirm}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={dlg.confirmText}>{confirmLabel}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const dlg = StyleSheet.create({
  backdrop: {
    position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 9999,
    justifyContent: 'center', alignItems: 'center',
  },
  box: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28,
    width: 380, maxWidth: '90%' as any,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)' as any,
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.gray[900], marginBottom: 10 },
  msg: { fontSize: 14.5, color: Colors.gray[600], lineHeight: 22, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 12 },
  cancel: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.gray[200],
    alignItems: 'center', cursor: 'pointer' as any,
  },
  cancelText: { color: Colors.gray[700], fontWeight: '600', fontSize: 14.5 },
  confirm: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.lg,
    alignItems: 'center', cursor: 'pointer' as any,
  },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
});

// ── Error / success toast ─────────────────────────────────────────────────────
function Toast({ msg, type, onDismiss }: { msg: string; type: 'error' | 'success'; onDismiss: () => void }) {
  const isErr = type === 'error';
  return (
    <View style={[toast.wrap, isErr ? toast.errWrap : toast.okWrap]}>
      <Ionicons
        name={isErr ? 'alert-circle-outline' : 'checkmark-circle-outline'}
        size={18}
        color={isErr ? '#DC2626' : '#16A34A'}
      />
      <Text style={[toast.msg, { color: isErr ? '#DC2626' : '#16A34A' }]}>{msg}</Text>
      <TouchableOpacity onPress={onDismiss}>
        <Ionicons name="close" size={16} color={isErr ? '#DC2626' : '#16A34A'} />
      </TouchableOpacity>
    </View>
  );
}
const toast = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: Spacing.xxl, marginBottom: Spacing.md,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  errWrap: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  okWrap:  { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  msg: { flex: 1, fontSize: 13.5 },
});

// ── Main ──────────────────────────────────────────────────────────────────────
type DialogState =
  | null
  | { type: 'sold';   prop: MyProperty }
  | { type: 'pause';  prop: MyProperty };

export default function MyPropertiesWeb() {
  const router = useRouter();
  const [properties, setProperties] = useState<MyProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/properties/mine?limit=50');
      setProperties(data.data ?? data);
    } catch {
      showToast('No se pudieron cargar tus propiedades');
    }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  // ── Actions ──
  const confirmSold = async () => {
    if (dialog?.type !== 'sold') return;
    const prop = dialog.prop;
    setActionLoading(prop.id);
    try {
      await api.patch(`/properties/${prop.id}/sold`);
      await load();
      showToast(`Propiedad marcada como ${prop.operation === 'rent' ? 'alquilada' : 'vendida'} ✓`, 'success');
    } catch {
      showToast('No se pudo actualizar la propiedad');
    } finally {
      setActionLoading(null);
      setDialog(null);
    }
  };

  const confirmPause = async () => {
    if (dialog?.type !== 'pause') return;
    const prop = dialog.prop;
    setActionLoading(prop.id);
    try {
      await api.patch(`/properties/${prop.id}/unpublish`);
      await load();
      showToast('Propiedad pausada', 'success');
    } catch {
      showToast('No se pudo pausar');
    } finally {
      setActionLoading(null);
      setDialog(null);
    }
  };

  const handlePublish = async (prop: MyProperty) => {
    setActionLoading(prop.id);
    try {
      await api.patch(`/properties/${prop.id}/publish`);
      await load();
      showToast('Propiedad enviada a revisión ✓', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.message ?? 'No se pudo publicar');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <View style={S.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={S.root}>
      {/* Confirm dialogs */}
      {dialog?.type === 'sold' && (
        <ConfirmDialog
          title={`Marcar como ${dialog.prop.operation === 'rent' ? 'alquilada' : 'vendida'}`}
          message={`¿Confirmas que "${dialog.prop.title}" ya fue ${dialog.prop.operation === 'rent' ? 'alquilada' : 'vendida'}? Dejará de aparecer en los resultados.`}
          confirmLabel={dialog.prop.operation === 'rent' ? 'Sí, fue alquilada' : 'Sí, fue vendida'}
          confirmColor="#16A34A"
          onConfirm={confirmSold}
          onCancel={() => setDialog(null)}
          loading={actionLoading === dialog.prop.id}
        />
      )}
      {dialog?.type === 'pause' && (
        <ConfirmDialog
          title="Pausar propiedad"
          message={`¿Pausar "${dialog.prop.title}"? Puedes volver a publicarla cuando quieras.`}
          confirmLabel="Pausar"
          confirmColor={Colors.gray[700]}
          onConfirm={confirmPause}
          onCancel={() => setDialog(null)}
          loading={actionLoading === dialog.prop.id}
        />
      )}

      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Mis propiedades</Text>
        <TouchableOpacity style={S.addBtn} onPress={() => router.push('/create-property')}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={S.inner}>
          {/* Toast */}
          {toastMsg && (
            <Toast msg={toastMsg.msg} type={toastMsg.type} onDismiss={() => setToastMsg(null)} />
          )}

          {properties.length === 0 ? (
            <View style={S.empty}>
              <Ionicons name="business-outline" size={64} color={Colors.gray[300]} />
              <Text style={S.emptyTitle}>Sin propiedades</Text>
              <Text style={S.emptyDesc}>Publicá tu primera propiedad y empieza a recibir consultas</Text>
              <TouchableOpacity style={S.publishBtn} onPress={() => router.push('/create-property')}>
                <Text style={S.publishBtnText}>Publicar propiedad</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={S.grid}>
              {properties.map((prop) => {
                const sc = STATUS_CONFIG[prop.status] ?? { label: prop.status, color: '#64748B', bg: '#F1F5F9' };
                const mainImg = prop.property_images?.find(i => i.is_main) ?? prop.property_images?.[0];
                const isBusy = actionLoading === prop.id;
                const canPublish  = ['draft', 'rejected', 'paused'].includes(prop.status);
                const canPause    = prop.status === 'published';
                const canMarkSold = prop.status === 'published';
                const isSold      = prop.status === 'sold_rented';

                return (
                  <View key={prop.id} style={S.card}>
                    {/* Thumbnail */}
                    <TouchableOpacity
                      onPress={() => router.push(`/property/${prop.slug}`)}
                      activeOpacity={0.85}
                    >
                      {mainImg ? (
                        <Image source={{ uri: getImageUrl(mainImg.url)! }} style={S.thumb} resizeMode="cover" />
                      ) : (
                        <View style={[S.thumb, S.noThumb]}>
                          <Ionicons name="image-outline" size={32} color={Colors.gray[300]} />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Info */}
                    <View style={S.cardBody}>
                      <View style={S.cardRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={S.cardTitle} numberOfLines={2}>{prop.title}</Text>
                          <Text style={S.cardSub} numberOfLines={1}>
                            {prop.zones ? `${prop.zones.name}, ${prop.zones.city}` : prop.address}
                          </Text>
                        </View>
                        <View style={[S.statusBadge, { backgroundColor: sc.bg }]}>
                          <Text style={[S.statusText, { color: sc.color }]}>{sc.label}</Text>
                        </View>
                      </View>

                      <View style={S.priceRow}>
                        <Text style={S.cardPrice}>
                          {prop.currency === 'USD' ? '$' : 'Bs.'} {Number(prop.price).toLocaleString()}
                        </Text>
                        <Text style={S.cardOp}>{OP_LABEL[prop.operation] ?? prop.operation}</Text>
                        {prop.views_count > 0 && (
                          <View style={S.viewsRow}>
                            <Ionicons name="eye-outline" size={12} color={Colors.gray[400]} />
                            <Text style={S.viewsText}>{prop.views_count} vistas</Text>
                          </View>
                        )}
                      </View>

                      {/* Rejection */}
                      {prop.rejection_reason && (
                        <View style={S.rejectBanner}>
                          <Ionicons name="warning-outline" size={14} color="#DC2626" />
                          <Text style={S.rejectText} numberOfLines={2}>{prop.rejection_reason}</Text>
                        </View>
                      )}

                      {/* Sold banner */}
                      {isSold && (
                        <View style={S.soldBanner}>
                          <Ionicons name="checkmark-circle" size={16} color="#2563EB" />
                          <Text style={S.soldText}>Marcada como {prop.operation === 'rent' ? 'alquilada' : 'vendida'}</Text>
                        </View>
                      )}

                      {/* Actions */}
                      {!isSold && (
                        <View style={S.actions}>
                          <TouchableOpacity
                            style={S.btnEdit}
                            onPress={() => router.push(`/edit-property?id=${prop.id}`)}
                          >
                            <Ionicons name="pencil-outline" size={14} color={Colors.primary} />
                            <Text style={S.btnEditText}>Editar</Text>
                          </TouchableOpacity>

                          {canPublish && (
                            <TouchableOpacity
                              style={[S.btnPrimary, isBusy && S.disabled]}
                              onPress={() => !isBusy && handlePublish(prop)}
                              disabled={isBusy}
                            >
                              {isBusy
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <><Ionicons name="cloud-upload-outline" size={14} color="#fff" /><Text style={S.btnPrimaryText}>Publicar</Text></>
                              }
                            </TouchableOpacity>
                          )}

                          {canPause && (
                            <TouchableOpacity
                              style={[S.btnSecondary, isBusy && S.disabled]}
                              onPress={() => !isBusy && setDialog({ type: 'pause', prop })}
                              disabled={isBusy}
                            >
                              <Ionicons name="pause-outline" size={14} color={Colors.gray[600]} />
                              <Text style={S.btnSecondaryText}>Pausar</Text>
                            </TouchableOpacity>
                          )}

                          {canMarkSold && (
                            <TouchableOpacity
                              style={[S.btnSold, isBusy && S.disabled]}
                              onPress={() => !isBusy && setDialog({ type: 'sold', prop })}
                              disabled={isBusy}
                            >
                              {isBusy
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <>
                                    <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                                    <Text style={S.btnPrimaryText}>
                                      {prop.operation === 'rent' ? 'Alquilada' : 'Vendida'}
                                    </Text>
                                  </>
                              }
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 16, paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900], textAlign: 'center' },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    cursor: 'pointer' as any,
  },

  inner: { maxWidth: 960, alignSelf: 'center', width: '100%', padding: Spacing.xxl },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[700], marginTop: Spacing.lg },
  emptyDesc: { fontSize: Fonts.sizes.md, color: Colors.gray[400], textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22, paddingHorizontal: 32 },
  publishBtn: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: Radius.full, marginTop: 24, cursor: 'pointer' as any },
  publishBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.md },

  grid: { gap: 16 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    boxShadow: '0 1px 6px rgba(0,0,0,0.07)' as any,
    borderWidth: 1, borderColor: Colors.gray[100],
  },
  thumb: { width: 140, height: '100%' as any, minHeight: 140 },
  noThumb: { backgroundColor: Colors.gray[100], justifyContent: 'center', alignItems: 'center' },

  cardBody: { flex: 1, padding: Spacing.lg, gap: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.gray[900], lineHeight: 20 },
  cardSub: { fontSize: Fonts.sizes.xs, color: Colors.gray[400], marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardPrice: { fontSize: Fonts.sizes.md, fontWeight: '800', color: Colors.primary },
  cardOp: { fontSize: Fonts.sizes.xs, fontWeight: '500', color: Colors.gray[500], backgroundColor: Colors.gray[100], paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewsText: { fontSize: Fonts.sizes.xs, color: Colors.gray[400] },

  rejectBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: 10, backgroundColor: '#FEE2E2', borderRadius: Radius.sm },
  rejectText: { flex: 1, fontSize: Fonts.sizes.xs, color: '#991B1B', lineHeight: 17 },
  soldBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: '#DBEAFE', borderRadius: Radius.sm },
  soldText: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: '#1D4ED8' },

  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  btnEdit: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: Colors.primary, cursor: 'pointer' as any,
  },
  btnEditText: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.primary },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.sm,
    backgroundColor: Colors.primary, cursor: 'pointer' as any,
  },
  btnPrimaryText: { fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.white },
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.sm,
    backgroundColor: Colors.gray[100], cursor: 'pointer' as any,
  },
  btnSecondaryText: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.gray[600] },
  btnSold: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.sm,
    backgroundColor: '#16A34A', cursor: 'pointer' as any,
  },
  disabled: { opacity: 0.5 },
});
