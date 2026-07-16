import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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

// Una sola vez por sesión de app
let shownThisSession = false;

/** Popup de publicidad al entrar: anuncio aleatorio de empresas con plan. */
export default function AdPopup() {
  const [ad, setAd] = useState<Ad | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (shownThisSession) return;
    shownThisSession = true;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/ads/serve');
        if (data) {
          setAd(data);
          setVisible(true);
        }
      } catch {}
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  if (!ad) return null;

  const openLink = () => {
    if (ad.link_url) Linking.openURL(ad.link_url);
    setVisible(false);
  };

  const width = Math.min(Dimensions.get('window').width - 48, 380);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <View style={[styles.card, { width }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)} hitSlop={10}>
            <Ionicons name="close" size={20} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={ad.link_url ? 0.9 : 1} onPress={openLink} disabled={!ad.link_url}>
            <Image
              source={{ uri: getImageUrl(ad.image_url)! }}
              style={[styles.image, { width, height: width }]}
              resizeMode="cover"
            />
          </TouchableOpacity>

          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{ad.title}</Text>
              <Text style={styles.company} numberOfLines={1}>{ad.company.name} · Publicidad</Text>
            </View>
            {ad.link_url && (
              <TouchableOpacity style={styles.linkBtn} onPress={openLink}>
                <Text style={styles.linkBtnText}>Ver más</Text>
                <Ionicons name="open-outline" size={14} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View>
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
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 5,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { backgroundColor: Colors.gray[100] },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  title: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.gray[900] },
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
