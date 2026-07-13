import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { Colors, Fonts, Radius, Spacing } from '../constants/theme';

interface NotificationBanner {
  id: string;
  title: string;
  message: string;
  type: string;
  data: Record<string, unknown> | null;
}

interface NotificationContextType {
  unreadCount: number;
  refreshUnread: () => void;
}

const NotificationCtx = createContext<NotificationContextType>({ unreadCount: 0, refreshUnread: () => {} });

export function useNotifications() {
  return useContext(NotificationCtx);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [banner, setBanner] = useState<NotificationBanner | null>(null);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const lastCheckRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnread = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.count ?? 0);
    } catch { /* */ }
  }, [isAuthenticated]);

  const checkNewNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await api.get('/notifications', { params: { limit: 1, unread: true } });
      const items = data.data ?? [];
      if (items.length > 0) {
        const newest = items[0];
        if (lastCheckRef.current && newest.id !== lastCheckRef.current) {
          showBanner(newest);
        }
        lastCheckRef.current = newest.id;
      }
      setUnreadCount(data.unreadCount ?? 0);
    } catch { /* */ }
  }, [isAuthenticated]);

  const showBanner = (notif: NotificationBanner) => {
    setBanner(notif);
    slideAnim.setValue(-120);
    Animated.sequence([
      Animated.spring(slideAnim, { toValue: 50, useNativeDriver: true, friction: 8 }),
      Animated.delay(4000),
      Animated.timing(slideAnim, { toValue: -120, duration: 300, useNativeDriver: true }),
    ]).start(() => setBanner(null));
  };

  const dismissBanner = () => {
    Animated.timing(slideAnim, { toValue: -120, duration: 200, useNativeDriver: true }).start(() => setBanner(null));
  };

  const handleBannerTap = () => {
    dismissBanner();
    if (banner) {
      api.patch(`/notifications/${banner.id}/read`).catch(() => {});
      const propertyId = (banner.data as any)?.property_id;
      if (propertyId) {
        router.push(`/property/${propertyId}`);
      } else {
        router.push('/notifications');
      }
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      lastCheckRef.current = null;
      return;
    }
    fetchUnread();
    // Initial check to set lastCheckRef
    checkNewNotifications();
    intervalRef.current = setInterval(checkNewNotifications, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isAuthenticated, fetchUnread, checkNewNotifications]);

  const getIconName = (type: string) => {
    if (type === 'property_approved') return 'checkmark-circle';
    if (type === 'property_rejected') return 'close-circle';
    return 'notifications';
  };

  const getIconColor = (type: string) => {
    if (type === 'property_approved') return Colors.success;
    if (type === 'property_rejected') return Colors.error;
    return Colors.primary;
  };

  return (
    <NotificationCtx.Provider value={{ unreadCount, refreshUnread: fetchUnread }}>
      {children}
      {banner && (
        <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity style={styles.bannerContent} onPress={handleBannerTap} activeOpacity={0.9}>
            <View style={[styles.bannerIcon, { backgroundColor: `${getIconColor(banner.type)}20` }]}>
              <Ionicons name={getIconName(banner.type) as any} size={20} color={getIconColor(banner.type)} />
            </View>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
              <Text style={styles.bannerMsg} numberOfLines={2}>{banner.message}</Text>
            </View>
            <TouchableOpacity onPress={dismissBanner} hitSlop={8}>
              <Ionicons name="close" size={18} color={Colors.gray[400]} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotificationCtx.Provider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerText: { flex: 1 },
  bannerTitle: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  bannerMsg: {
    fontSize: Fonts.sizes.xs,
    color: Colors.gray[500],
    marginTop: 1,
  },
});
