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

function AdCard({ ad }: { ad: Ad }) {
  const openLink = () => {
    if (ad.link_url) Linking.openURL(ad.link_url);
  };
  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={ad.link_url ? 0.9 : 1} onPress={openLink} disabled={!ad.link_url}>
        <Image source={{ uri: getImageUrl(ad.image_url)! }} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.adTag}>Publicidad</Text>
          <Text style={styles.title} numberOfLines={1}>{ad.title}</Text>
          <Text style={styles.company} numberOfLines={1}>{ad.company.name}</Text>
        </View>
        {ad.link_url && (
          <TouchableOpacity style={styles.linkBtn} onPress={openLink}>
            <Text style={styles.linkBtnText}>Ver más</Text>
            <Ionicons name="open-outline" size={14} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/** Dos anuncios de empresas, mismo tamaño/estilo que el popup de entrada. */
export default function AdSlot() {
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    api.get('/ads/serve', { params: { count: 2 } }).then((r) => setAds(r.data ?? [])).catch(() => {});
  }, []);

  if (ads.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {ads.map((ad) => <AdCard key={ad.id} ad={ad} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.xl, gap: Spacing.lg },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.gray[100],
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  image: { width: '100%', aspectRatio: 1, backgroundColor: Colors.gray[100] },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  adTag: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.gray[400],
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.gray[900], marginTop: 2 },
  company: { fontSize: Fonts.sizes.xs, color: Colors.gray[400], marginTop: 2 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  linkBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.sm },
});
