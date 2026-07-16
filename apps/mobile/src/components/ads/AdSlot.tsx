import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getImageUrl } from '../../constants/api';
import { Colors, Fonts, Radius, Spacing } from '../../constants/theme';
import api from '../../services/api';

interface Ad {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  company: { name: string; logo_url: string | null };
}

/** Banner de publicidad embebido (ej. al pie del detalle de propiedad). */
export default function AdSlot() {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    api.get('/ads/serve').then((r) => setAd(r.data)).catch(() => {});
  }, []);

  if (!ad) return null;

  const openLink = () => {
    if (ad.link_url) Linking.openURL(ad.link_url);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={ad.link_url ? 0.9 : 1}
      onPress={openLink}
      disabled={!ad.link_url}
    >
      <Image source={{ uri: getImageUrl(ad.image_url)! }} style={styles.image} resizeMode="cover" />
      <View style={styles.info}>
        <Text style={styles.adTag}>Publicidad</Text>
        <Text style={styles.title} numberOfLines={2}>{ad.title}</Text>
        <Text style={styles.company} numberOfLines={1}>{ad.company.name}</Text>
      </View>
      {ad.link_url && <Ionicons name="open-outline" size={18} color={Colors.gray[400]} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.gray[50],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.gray[100],
    padding: Spacing.md,
    marginTop: Spacing.xl,
  },
  image: { width: 72, height: 72, borderRadius: Radius.md, backgroundColor: Colors.gray[100] },
  info: { flex: 1 },
  adTag: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.gray[400],
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.gray[800], marginTop: 2 },
  company: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginTop: 1 },
});
