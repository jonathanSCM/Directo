import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/constants/theme';
import ChatFAB from '../../src/components/support/ChatFAB';
import OwnerSupportFAB from '../../src/components/support/OwnerSupportChat';
import SubscriptionPromoModal from '../../src/components/subscription/SubscriptionPromoModal';
import PublishFreeBanner from '../../src/components/subscription/PublishFreeBanner';
import AdPopup from '../../src/components/ads/AdPopup';
import { useRoleColors } from '../../src/hooks/useRoleColors';

export default function TabsLayout() {
  const { user } = useAuth();
  const isOwner = user?.active_role === 'owner';
  const { accent } = useRoleColors();

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: Colors.gray[400],
        tabBarStyle: {
          height: 85,
          paddingTop: 8,
          paddingBottom: 28,
          borderTopWidth: 1,
          borderTopColor: Colors.gray[200],
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: isOwner ? 'Mis Propiedades' : 'Guardados',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={isOwner ? 'business-outline' : 'heart-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
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
    {isOwner ? <OwnerSupportFAB /> : <ChatFAB />}
    <SubscriptionPromoModal />
    <PublishFreeBanner />
    <AdPopup />
    </View>
  );
}
