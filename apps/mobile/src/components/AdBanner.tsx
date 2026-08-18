import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getImageUrl } from '../constants/api';
import api from '../services/api';
import { Colors, Fonts, Radius, Spacing } from '../constants/theme';

interface Ad {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
}

/**
 * Banner de marca (publicidad cargada por el admin) para el detalle de una
 * propiedad. No invasivo a propósito: una sola tarjeta chica, etiquetada
 * como "Publicidad", al final del scroll — no interrumpe la info de la
 * propiedad ni compite con el botón de contacto. Si no hay ads disponibles,
 * no renderiza nada (sin hueco vacío).
 */
export default function AdBanner({
  latitude,
  longitude,
}: {
  latitude?: number | null;
  longitude?: number | null;
}) {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params: Record<string, any> = { count: 1, placement: 'banner' };
        if (latitude != null && longitude != null) {
          params.lat = latitude;
          params.lng = longitude;
        }
        const { data } = await api.get('/ads/serve', { params });
        if (!cancelled && Array.isArray(data) && data[0]) setAd(data[0]);
      } catch {
        // silencioso: la publicidad nunca debe romper el detalle de la propiedad
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  if (!ad) return null;

  const imageUri = getImageUrl(ad.image_url);
  if (!imageUri) return null;

  const content = (
    <View style={styles.card}>
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      <View style={styles.tag}>
        <Text style={styles.tagText}>Publicidad</Text>
      </View>
      {ad.link_url && (
        <View style={styles.linkHint}>
          <Ionicons name="open-outline" size={12} color={Colors.white} />
        </View>
      )}
    </View>
  );

  if (!ad.link_url) return content;

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(ad.link_url!)}>
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.gray[100],
    position: 'relative',
    marginTop: Spacing.xxl,
  },
  image: {
    width: '100%',
    height: 96,
  },
  tag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15,23,42,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  tagText: {
    color: Colors.white,
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
  },
  linkHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15,23,42,0.65)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
