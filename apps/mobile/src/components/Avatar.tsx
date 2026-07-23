import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getImageUrl } from '../constants/api';
import { Colors } from '../constants/theme';

interface Props {
  name?: string;
  avatarUrl?: string | null;
  verified?: boolean;
  size?: number;
  onPress?: () => void;
}

/** Foto de perfil (o inicial del nombre si no tiene) con un anillo azul + check si el usuario está verificado. */
export default function Avatar({ name, avatarUrl, verified, size = 56, onPress }: Props) {
  const initial = name?.charAt(0).toUpperCase() ?? '?';
  const uri = getImageUrl(avatarUrl);
  const outerSize = size + (verified ? 6 : 0);
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      style={[
        styles.ring,
        {
          width: outerSize,
          height: outerSize,
          borderRadius: outerSize / 2,
          borderWidth: verified ? 2 : 0,
        },
        verified && styles.ringVerified,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: Colors.primary }}>{initial}</Text>
        </View>
      )}
      {verified && (
        <View style={styles.badge}>
          <Ionicons name="checkmark-circle" size={Math.max(14, size * 0.3)} color="#2563EB" />
        </View>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  ring: { justifyContent: 'center', alignItems: 'center' },
  ringVerified: { borderColor: '#2563EB' },
  fallback: { backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: Colors.white,
    borderRadius: 999,
  },
});
