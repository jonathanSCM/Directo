import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts, Radius } from '../constants/theme';
import { useRoleColors } from '../hooks/useRoleColors';

/** Pill que marca claramente en qué modo estás (comprador / propietario). */
export default function RoleBadge() {
  const { isOwner, accent, accentLight } = useRoleColors();
  return (
    <View style={[styles.badge, { backgroundColor: accentLight }]}>
      <Ionicons name={isOwner ? 'briefcase' : 'search'} size={11} color={accent} />
      <Text style={[styles.text, { color: accent }]}>
        {isOwner ? 'Modo Propietario' : 'Modo Comprador'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  text: { fontSize: Fonts.sizes.xs, fontWeight: '800' },
});
