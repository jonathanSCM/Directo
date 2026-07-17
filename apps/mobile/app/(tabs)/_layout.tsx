import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { Colors, Radius } from '../../src/constants/theme';
import OwnerSupportFAB from '../../src/components/support/OwnerSupportChat';
import SubscriptionPromoModal from '../../src/components/subscription/SubscriptionPromoModal';
import PublishFreeBanner from '../../src/components/subscription/PublishFreeBanner';
import AdPopup from '../../src/components/ads/AdPopup';
import { useRoleColors } from '../../src/hooks/useRoleColors';

const ICONS: Record<string, { active: any; inactive: any }> = {
  index: { active: 'compass', inactive: 'compass-outline' },
  ownerSaved: { active: 'business', inactive: 'business-outline' },
  buyerSaved: { active: 'heart', inactive: 'heart-outline' },
  profile: { active: 'person-circle', inactive: 'person-outline' },
};

function TabPill({
  focused,
  name,
  color,
  accentLight,
}: {
  focused: boolean;
  name: any;
  color: string;
  accentLight: string;
}) {
  return (
    <View style={[styles.pill, focused && { backgroundColor: accentLight }]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  const isOwner = user?.active_role === 'owner';
  const { accent, accentLight } = useRoleColors();

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: Colors.gray[400],
        tabBarStyle: Platform.select({
          web: {
            height: 64,
            paddingTop: 8,
            paddingBottom: 8,
            borderTopWidth: 1,
            borderTopColor: Colors.gray[100],
            backgroundColor: Colors.white,
          },
          default: {
            height: 85,
            paddingTop: 10,
            paddingBottom: 28,
            borderTopWidth: 1,
            borderTopColor: Colors.gray[100],
            backgroundColor: Colors.white,
          },
        }),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: Platform.OS === 'web' ? 2 : 0,
        },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, focused }) => (
            <TabPill
              focused={focused}
              color={color}
              accentLight={accentLight}
              name={focused ? ICONS.index.active : ICONS.index.inactive}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: isOwner ? 'Mis Propiedades' : 'Guardados',
          tabBarIcon: ({ color, focused }) => {
            const set = isOwner ? ICONS.ownerSaved : ICONS.buyerSaved;
            return (
              <TabPill
                focused={focused}
                color={color}
                accentLight={accentLight}
                name={focused ? set.active : set.inactive}
              />
            );
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabPill
              focused={focused}
              color={color}
              accentLight={accentLight}
              name={focused ? ICONS.profile.active : ICONS.profile.inactive}
            />
          ),
        }}
      />
      {/* Hide the old messages tab */}
      <Tabs.Screen
        name="messages"
        options={{
          href: null,
        }}
      />
    </Tabs>
    {isOwner && <OwnerSupportFAB />}
    <SubscriptionPromoModal />
    <PublishFreeBanner />
    <AdPopup />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 44,
    height: 30,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
