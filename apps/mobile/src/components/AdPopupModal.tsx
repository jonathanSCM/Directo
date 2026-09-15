import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getImageUrl } from '../constants/api';
import api from '../services/api';
import { Colors, Fonts, Radius, Spacing } from '../constants/theme';

const SCREEN = Dimensions.get('window');
const CARD_MAX_WIDTH = Math.min(440, SCREEN.width - Spacing.lg * 2);
const IMAGE_HEIGHT = Math.min(520, SCREEN.height * 0.55);

interface Ad {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
}

const LAST_SHOWN_KEY = 'ad_popup_last_shown';
const COOLDOWN_MINUTES = 2;

/**
 * Pop-up de publicidad (mismos banners que carga el admin) que aparece al
 * entrar a la pestaña Explorar, como mucho una vez cada COOLDOWN_MINUTES —
 * evita que se repita en cada entrada/salida rápida de una propiedad. Si no
 * hay ad disponible, no muestra nada.
 */
export default function AdPopupModal({
  latitude,
  longitude,
}: {
  latitude?: number | null;
  longitude?: number | null;
}) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [visible, setVisible] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const lastShown = await AsyncStorage.getItem(LAST_SHOWN_KEY);
          if (lastShown) {
            const elapsedMs = Date.now() - Number(lastShown);
            if (elapsedMs < COOLDOWN_MINUTES * 60 * 1000) return;
          }

          const params: Record<string, any> = { count: 1, placement: 'popup' };
          if (latitude != null && longitude != null) {
            params.lat = latitude;
            params.lng = longitude;
          }
          const { data } = await api.get('/ads/serve', { params });
          if (!cancelled && Array.isArray(data) && data[0]) {
            setImageLoading(true);
            setAd(data[0]);
            setVisible(true);
            AsyncStorage.setItem(LAST_SHOWN_KEY, Date.now().toString());
          }
        } catch {
          // silencioso: la publicidad nunca debe romper la pantalla
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const close = () => setVisible(false);

  if (!ad) return null;
  const imageUri = getImageUrl(ad.image_url);
  if (!imageUri) return null;

  const handlePress = () => {
    api.post(`/ads/${ad.id}/click`).catch(() => {});
    if (ad.link_url) Linking.openURL(ad.link_url);
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity activeOpacity={0.92} onPress={handlePress}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="cover"
              onLoadEnd={() => setImageLoading(false)}
            />
            {imageLoading && (
              <View style={styles.imagePlaceholder}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
            <View style={styles.tag}>
              <Text style={styles.tagText}>Publicidad</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={close} hitSlop={10}>
            <Ionicons name="close" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.gray[100],
  },
  image: { width: '100%', height: IMAGE_HEIGHT },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  tag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(15,23,42,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  tagText: { color: Colors.white, fontSize: Fonts.sizes.xs, fontWeight: '700' },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
