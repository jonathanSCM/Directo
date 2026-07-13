import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';
import api from '../src/services/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  read_at: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications', {
        params: { limit: 50 },
      });
      setNotifications(data.data ?? data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNotifications();
    }, [fetchNotifications]),
  );

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      );
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      );
    } catch {
      // silent
    }
  };

  const handlePress = (item: Notification) => {
    if (!item.read_at) markAsRead(item.id);

    const propertyId = (item.data as any)?.property_id;
    if (propertyId) {
      router.push(`/property/${propertyId}`);
    }
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(iso).toLocaleDateString('es-BO', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getIcon = (type: string): { name: string; color: string } => {
    switch (type) {
      case 'property_approved':
        return { name: 'checkmark-circle', color: Colors.success };
      case 'property_rejected':
        return { name: 'close-circle', color: Colors.error };
      case 'visit_request_received':
        return { name: 'calendar', color: '#2563eb' };
      case 'visit_request_updated':
        return { name: 'calendar-outline', color: '#7c3aed' };
      default:
        return { name: 'notifications', color: Colors.primary };
    }
  };

  const openWhatsApp = (phone: string, buyerName: string, propertyTitle?: string) => {
    const clean = phone.replace(/\D/g, '');
    const msg = propertyTitle
      ? `Hola ${buyerName}, te escribo por tu solicitud de visita a "${propertyTitle}" en DIRECTO.`
      : `Hola ${buyerName}, te contactamos desde DIRECTO.`;
    Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`);
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const renderItem = ({ item }: { item: Notification }) => {
    const isUnread = !item.read_at;
    const icon = getIcon(item.type);
    const d = item.data as any;
    const isVisitRequest = item.type === 'visit_request_received' && d?.buyer_phone;

    return (
      <TouchableOpacity
        style={[styles.item, isUnread && styles.itemUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: `${icon.color}15` }]}>
          <Ionicons name={icon.name as any} size={22} color={icon.color} />
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.itemTime}>{formatTime(item.created_at)}</Text>
          </View>
          <Text style={styles.itemMessage} numberOfLines={2}>
            {item.message}
          </Text>
          {isVisitRequest && (
            <View style={styles.visitDetails}>
              <View style={styles.buyerInfo}>
                <Text style={styles.buyerName}>{d.buyer_name}</Text>
                {d.buyer_email && <Text style={styles.buyerDetail}>{d.buyer_email}</Text>}
                {d.buyer_phone && <Text style={styles.buyerDetail}>{d.buyer_phone}</Text>}
                {d.preferred_date && (
                  <Text style={styles.buyerDetail}>
                    Fecha: {d.preferred_date} a las {d.preferred_time}
                  </Text>
                )}
                {d.visitor_message && (
                  <Text style={styles.buyerDetail} numberOfLines={2}>
                    "{d.visitor_message}"
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={() => openWhatsApp(d.buyer_phone, d.buyer_name, d.property_slug)}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                <Text style={styles.whatsappText}>Contactar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.header}>Notificaciones</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.readAllBtn}>
            <Text style={styles.readAllText}>Leer todo</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={64} color={Colors.gray[300]} />
          <Text style={styles.emptyTitle}>Sin notificaciones</Text>
          <Text style={styles.emptyDesc}>
            Cuando recibas notificaciones aparecerán aquí
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchNotifications();
              }}
              colors={[Colors.primary]}
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingTop: 60 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  header: {
    flex: 1,
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  readAllBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  readAllText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  center: {
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
  emptyDesc: {
    fontSize: Fonts.sizes.md,
    color: Colors.gray[400],
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    gap: Spacing.md,
  },
  itemUnread: {
    backgroundColor: '#F0F5FF',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: { flex: 1 },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: '500',
    color: Colors.gray[700],
    flex: 1,
    marginRight: Spacing.sm,
  },
  itemTitleUnread: {
    fontWeight: '700',
    color: Colors.gray[900],
  },
  itemTime: {
    fontSize: Fonts.sizes.xs,
    color: Colors.gray[400],
  },
  itemMessage: {
    fontSize: Fonts.sizes.sm,
    color: Colors.gray[500],
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  visitDetails: {
    marginTop: Spacing.sm,
    backgroundColor: '#f0f5ff',
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  buyerInfo: {
    marginBottom: Spacing.sm,
  },
  buyerName: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 2,
  },
  buyerDetail: {
    fontSize: Fonts.sizes.xs,
    color: Colors.gray[600],
    lineHeight: 16,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    borderRadius: Radius.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    gap: 6,
    alignSelf: 'flex-start',
  },
  whatsappText: {
    color: '#fff',
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
  },
});
