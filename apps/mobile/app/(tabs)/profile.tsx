import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { useNotifications } from '../../src/context/NotificationContext';
import { Colors, Fonts, Radius, Spacing } from '../../src/constants/theme';
import { useRoleColors } from '../../src/hooks/useRoleColors';
import RoleBadge from '../../src/components/RoleBadge';
import Avatar from '../../src/components/Avatar';
import api from '../../src/services/api';

const IS_DESKTOP = Dimensions.get('window').width >= 768;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, roles, isAuthenticated, switchRole, logout } = useAuth();
  const { count: savedCount } = useFavorites();
  const { unreadCount } = useNotifications();
  const { accent, accentLight } = useRoleColors();
  const isOwner = user?.active_role === 'owner';
  const [ownerSavesCount, setOwnerSavesCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!isOwner) return;
      api.get('/properties/mine/saves-count')
        .then(({ data }) => setOwnerSavesCount(data.count ?? 0))
        .catch(() => {});
    }, [isOwner]),
  );

  if (!isAuthenticated || !user) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Perfil</Text>
        <View style={styles.empty}>
          <Ionicons name="person-outline" size={64} color={Colors.gray[300]} />
          <Text style={styles.emptyTitle}>No has iniciado sesión</Text>
          <Text style={styles.emptyDesc}>
            Crea una cuenta o inicia sesión para guardar propiedades, publicar
            las tuyas y contactar propietarios
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.loginBtnText}>Iniciar sesión</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.registerLink}>Crear cuenta</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }


  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // Alert.alert no muestra botones en react-native-web
      if (window.confirm('¿Cerrar sesión?')) logout();
      return;
    }
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
    ]);
  };

  const handleSwitchRole = async (toOwner: boolean) => {
    try {
      await switchRole(toOwner ? 'owner' : 'buyer');
    } catch {
      Alert.alert('Error', 'No se pudo cambiar el modo');
    }
  };

  const summaryBlock = (
    <>
      {/* User card */}
      <View style={[styles.userCard, IS_DESKTOP && styles.noHPad]}>
        <Avatar name={user.name} avatarUrl={user.avatar_url} verified={user.is_verified} size={64} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          {user.phone && (
            <Text style={styles.userPhone}>{user.phone}</Text>
          )}
          <View style={{ marginTop: 6 }}>
            <RoleBadge />
          </View>
        </View>
      </View>

      {/* Role switcher */}
      {roles.includes('buyer') && roles.includes('owner') && (
        <View style={[styles.roleCard, IS_DESKTOP && styles.noHMargin]}>
          <Text style={styles.roleLabel}>Modo actual</Text>
          <View style={styles.roleSwitch}>
            <TouchableOpacity
              style={[styles.roleBtn, !isOwner && { backgroundColor: Colors.primary }]}
              onPress={() => handleSwitchRole(false)}
            >
              <Ionicons
                name="search"
                size={16}
                color={!isOwner ? Colors.white : Colors.gray[500]}
              />
              <Text
                style={[styles.roleBtnText, !isOwner && styles.roleBtnTextActive]}
              >
                Comprador
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, isOwner && { backgroundColor: '#7C3AED' }]}
              onPress={() => handleSwitchRole(true)}
            >
              <Ionicons
                name="business"
                size={16}
                color={isOwner ? Colors.white : Colors.gray[500]}
              />
              <Text
                style={[styles.roleBtnText, isOwner && styles.roleBtnTextActive]}
              >
                Propietario
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.roleHint}>
            {isOwner
              ? 'Puedes ver y administrar tus propiedades publicadas'
              : 'Estás buscando propiedades para comprar o alquilar'}
          </Text>
        </View>
      )}

      {/* Quick stats */}
      <View style={[styles.quickStats, IS_DESKTOP && styles.noHPad]}>
        <TouchableOpacity
          style={styles.quickStatItem}
          onPress={() => router.push('/(tabs)/saved')}
        >
          <Ionicons name="heart" size={22} color="#EF4444" />
          <Text style={styles.quickStatNum}>{isOwner ? ownerSavesCount : savedCount}</Text>
          <Text style={styles.quickStatLabel}>
            {isOwner ? 'Guardaron tus props.' : 'Guardados'}
          </Text>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity
            style={styles.quickStatItem}
            onPress={() => router.push('/(tabs)/saved')}
          >
            <Ionicons name="business" size={22} color={Colors.primary} />
            <Text style={styles.quickStatNum}>Ver</Text>
            <Text style={styles.quickStatLabel}>Mis propiedades</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* CTA principal para un propietario nuevo */}
      {isOwner && (
        <TouchableOpacity
          style={[styles.publishCta, IS_DESKTOP && styles.noHMargin]}
          onPress={() => router.push('/create-property')}
        >
          <Ionicons name="add-circle" size={22} color={Colors.white} />
          <Text style={styles.publishCtaText}>Publicar una propiedad</Text>
        </TouchableOpacity>
      )}
    </>
  );

  const menuBlock = (
    <View style={[styles.menu, IS_DESKTOP && styles.noHPad]}>
      <Text style={styles.menuSection}>General</Text>

      <MenuItem
        icon="person-outline"
        label="Editar perfil"
        onPress={() => router.push('/edit-profile')}
      />
      <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notifications')}>
        <View>
          <Ionicons name="notifications-outline" size={22} color={Colors.gray[600]} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.menuText}>Notificaciones</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
      </TouchableOpacity>

      {isOwner && (
        <>
          <Text style={[styles.menuSection, { marginTop: Spacing.lg }]}>
            Propietario
          </Text>
          <Text style={styles.menuSectionHint}>
            Administra tus propiedades y tu plan
          </Text>
          <MenuItem
            icon="add-circle-outline"
            label="Publicar propiedad"
            onPress={() => router.push('/create-property')}
          />
          <MenuItem
            icon="business-outline"
            label="Mis propiedades"
            onPress={() => router.push('/(tabs)/saved')}
          />
          <MenuItem
            icon="card-outline"
            label="Mi suscripción"
            onPress={() => router.push('/subscription')}
          />
        </>
      )}

      <Text style={[styles.menuSection, { marginTop: Spacing.lg }]}>
        Soporte
      </Text>
      <MenuItem
        icon="help-circle-outline"
        label="Ayuda"
        onPress={() => {}}
      />
      <MenuItem
        icon="logo-whatsapp"
        label="Contactar soporte"
        color="#25D366"
        onPress={() =>
          Linking.openURL(
            'https://wa.me/59170000000?text=Hola, necesito ayuda con DIRECTO',
          )
        }
      />

      <TouchableOpacity
        style={[styles.menuItem, { marginTop: Spacing.lg }]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={22} color={Colors.error} />
        <Text style={[styles.menuText, { color: Colors.error }]}>
          Cerrar sesión
        </Text>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={Colors.gray[400]}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={styles.header}>Perfil</Text>

      {IS_DESKTOP ? (
        <View style={styles.desktopRow}>
          <View style={styles.desktopCol}>{summaryBlock}</View>
          <View style={[styles.desktopCol, styles.desktopColMenu]}>{menuBlock}</View>
        </View>
      ) : (
        <>
          {summaryBlock}
          {menuBlock}
        </>
      )}
    </ScrollView>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  color,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Ionicons
        name={icon as any}
        size={22}
        color={color ?? Colors.gray[600]}
      />
      <Text style={styles.menuText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingTop: 60 },
  header: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.gray[900],
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    marginTop: 80,
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
    lineHeight: 22,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: 14,
    borderRadius: Radius.full,
    marginTop: Spacing.xxl,
  },
  loginBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: Fonts.sizes.md,
  },
  registerLink: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: Fonts.sizes.md,
    marginTop: Spacing.lg,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: '700',
    color: Colors.primary,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  userEmail: {
    fontSize: Fonts.sizes.sm,
    color: Colors.gray[500],
    marginTop: 2,
  },
  userPhone: {
    fontSize: Fonts.sizes.sm,
    color: Colors.gray[400],
    marginTop: 1,
  },
  roleCard: {
    marginHorizontal: Spacing.xxl,
    padding: Spacing.lg,
    backgroundColor: Colors.gray[50],
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
  },
  roleLabel: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.gray[500],
    marginBottom: Spacing.sm,
  },
  roleSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.gray[200],
    borderRadius: Radius.full,
    padding: 3,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  roleBtnText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.gray[500],
  },
  roleBtnTextActive: { color: Colors.white },
  roleHint: {
    fontSize: Fonts.sizes.xs,
    color: Colors.gray[400],
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.gray[50],
    borderRadius: Radius.md,
  },
  quickStatNum: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.gray[900],
    marginTop: 4,
  },
  quickStatLabel: {
    fontSize: Fonts.sizes.xs,
    color: Colors.gray[500],
    marginTop: 2,
  },
  menu: { paddingHorizontal: Spacing.xxl },
  menuSection: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
    color: Colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    gap: Spacing.md,
  },
  menuText: {
    flex: 1,
    fontSize: Fonts.sizes.md,
    color: Colors.gray[700],
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: Colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '700',
  },

  // ── Escritorio: resumen a la izquierda, menú a la derecha ──
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xxl,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  desktopCol: { flex: 1 },
  desktopColMenu: { flex: 1.2 },
  // El padding/margen horizontal de las tarjetas ya lo aporta desktopRow;
  // se anula en los hijos para no duplicarlo en escritorio.
  noHPad: { paddingHorizontal: 0 },
  noHMargin: { marginHorizontal: 0 },

  publishCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    marginHorizontal: Spacing.xxl,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    cursor: 'pointer' as any,
  },
  publishCtaText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.md },
  menuSectionHint: {
    fontSize: Fonts.sizes.xs,
    color: Colors.gray[400],
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
});
