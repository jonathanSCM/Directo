import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getImageUrl } from '../src/constants/api';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';
import api from '../src/services/api';

interface Ad {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  status: string;
  views_purchased: number;
  views_used: number;
  ends_at: string | null;
}

interface Company {
  id: string;
  name: string;
  website: string | null;
  ads: Ad[];
}

interface Zone {
  id: string;
  name: string;
  city: string;
}

const notice = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

export default function CompanyScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);

  // Form empresa
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');

  // Form anuncio
  const [adTitle, setAdTitle] = useState('');
  const [adLink, setAdLink] = useState('');
  const [adImage, setAdImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/companies/mine');
      setCompany(data);
      if (data) {
        setName(data.name);
        setWebsite(data.website ?? '');
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/zones').then((r) => setZones(r.data ?? [])).catch(() => {}); }, []);

  const zonesByCity = useMemo(() => {
    const map: Record<string, Zone[]> = {};
    for (const z of zones) (map[z.city] ??= []).push(z);
    return map;
  }, [zones]);

  const toggleZone = (id: string) => {
    setSelectedZones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveCompany = async () => {
    if (name.trim().length < 2) {
      notice('Falta el nombre', 'Escribe el nombre de tu empresa');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = { name: name.trim() };
      if (website.trim()) body.website = website.trim();
      await api.post('/companies', body);
      notice('Guardado', 'Tu empresa está lista. Ahora crea tu publicidad.');
      load();
    } catch (e: any) {
      notice('Error', e.response?.data?.message ?? 'No se pudo guardar');
    }
    setSaving(false);
  };

  const pickAdImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled) setAdImage(result.assets[0]);
  };

  const createAd = async () => {
    if (!adImage || adTitle.trim().length < 3) {
      notice('Faltan datos', 'El anuncio necesita imagen y título');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', adTitle.trim());
      if (adLink.trim()) formData.append('link_url', adLink.trim());
      if (selectedZones.size > 0) {
        formData.append('zone_ids', JSON.stringify(Array.from(selectedZones)));
      }
      if (Platform.OS === 'web') {
        const resp = await fetch(adImage.uri);
        const blob = await resp.blob();
        const ext = adImage.fileName?.split('.').pop() ?? 'jpg';
        formData.append('image', blob, adImage.fileName ?? `ad.${ext}`);
        await api.post('/companies/mine/ads', formData, {
          headers: { 'Content-Type': undefined },
        });
      } else {
        const ext = adImage.uri.split('.').pop() ?? 'jpg';
        formData.append('image', {
          uri: adImage.uri,
          type: adImage.mimeType ?? `image/${ext}`,
          name: adImage.fileName ?? `ad.${ext}`,
        } as any);
        await api.post('/companies/mine/ads', formData);
      }
      setAdTitle('');
      setAdLink('');
      setAdImage(null);
      setSelectedZones(new Set());
      notice('Anuncio creado', 'Tu publicidad ya está circulando en la app y la web.');
      load();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      notice('Error', typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : 'No se pudo crear');
    }
    setSaving(false);
  };

  const toggleAd = async (ad: Ad) => {
    const next = ad.status === 'active' ? 'paused' : 'active';
    try {
      await api.patch(`/companies/mine/ads/${ad.id}/status`, { status: next });
      load();
    } catch {}
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi empresa</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Empresa */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {company ? 'Datos de la empresa' : 'Crea tu empresa'}
          </Text>
          <Text style={styles.label}>Nombre *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ej: Constructora Andina"
            placeholderTextColor={Colors.gray[400]}
          />
          <Text style={styles.label}>Sitio web (opcional)</Text>
          <TextInput
            style={styles.input}
            value={website}
            onChangeText={setWebsite}
            placeholder="https://miempresa.com"
            placeholderTextColor={Colors.gray[400]}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={saveCompany} disabled={saving}>
            <Text style={styles.primaryBtnText}>
              {saving ? 'Guardando...' : company ? 'Guardar cambios' : 'Crear empresa'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Crear anuncio */}
        {company && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nueva publicidad</Text>
            <Text style={styles.hint}>
              Tu anuncio saldrá en el popup de entrada y en los detalles de propiedades,
              en la app y en la web.
            </Text>

            <TouchableOpacity style={styles.imagePicker} onPress={pickAdImage}>
              {adImage ? (
                <Image source={{ uri: adImage.uri }} style={styles.adPreview} resizeMode="cover" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={32} color={Colors.gray[400]} />
                  <Text style={styles.imagePickerText}>Elegir imagen del anuncio</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={styles.input}
              value={adTitle}
              onChangeText={setAdTitle}
              placeholder="Ej: Departamentos en preventa"
              placeholderTextColor={Colors.gray[400]}
              maxLength={120}
            />
            <Text style={styles.label}>Link (opcional)</Text>
            <TextInput
              style={styles.input}
              value={adLink}
              onChangeText={setAdLink}
              placeholder="https://miempresa.com/promo"
              placeholderTextColor={Colors.gray[400]}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Zonas donde quieres publicidad (opcional)</Text>
            <Text style={styles.hint}>
              Elige las zonas donde quieres aparecer primero. El sistema detecta la
              ubicación del cliente y prioriza tu anuncio ahí; si no eliges ninguna,
              tu anuncio se muestra en cualquier sector.
            </Text>
            {Object.entries(zonesByCity).map(([city, cityZones]) => (
              <View key={city} style={styles.zoneCityBlock}>
                <Text style={styles.zoneCityLabel}>{city}</Text>
                <View style={styles.zoneChipsWrap}>
                  {cityZones.map((z) => {
                    const active = selectedZones.has(z.id);
                    return (
                      <TouchableOpacity
                        key={z.id}
                        style={[styles.zoneChip, active && styles.zoneChipActive]}
                        onPress={() => toggleZone(z.id)}
                      >
                        <Text style={[styles.zoneChipText, active && styles.zoneChipTextActive]}>
                          {z.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.primaryBtn} onPress={createAd} disabled={saving}>
              <Text style={styles.primaryBtnText}>{saving ? 'Creando...' : 'Publicar anuncio'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Mis anuncios */}
        {company && company.ads.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mis anuncios</Text>
            {company.ads.map((ad) => (
              <View key={ad.id} style={styles.adRow}>
                <Image source={{ uri: getImageUrl(ad.image_url)! }} style={styles.adThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adTitle} numberOfLines={1}>{ad.title}</Text>
                  <Text style={styles.adMeta}>
                    {ad.views_used.toLocaleString()} / {ad.views_purchased.toLocaleString()} vistas
                  </Text>
                  <View style={[styles.adStatus, ad.status !== 'active' && styles.adStatusPaused]}>
                    <Text style={styles.adStatusText}>
                      {ad.status === 'active' ? 'Activo' : 'Pausado'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.toggleBtn} onPress={() => toggleAd(ad)}>
                  <Ionicons
                    name={ad.status === 'active' ? 'pause' : 'play'}
                    size={18}
                    color={Colors.gray[600]}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  content: { padding: Spacing.xxl, paddingBottom: 60, width: '100%', maxWidth: 640, alignSelf: 'center' },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900], marginBottom: Spacing.md },
  hint: { fontSize: Fonts.sizes.sm, color: Colors.gray[500], marginBottom: Spacing.md, lineHeight: 19 },
  label: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[700], marginTop: Spacing.md, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Fonts.sizes.md,
    color: Colors.gray[900],
    backgroundColor: Colors.white,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.md },

  imagePicker: {
    height: 160,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    backgroundColor: Colors.gray[50],
  },
  imagePickerText: { fontSize: Fonts.sizes.sm, color: Colors.gray[400] },
  adPreview: { width: '100%', height: '100%' },

  adRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  adThumb: { width: 56, height: 56, borderRadius: Radius.md, backgroundColor: Colors.gray[100] },
  adTitle: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.gray[800] },
  adMeta: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginTop: 2 },
  adStatus: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  adStatusPaused: { backgroundColor: Colors.gray[100] },
  adStatusText: { fontSize: 10, fontWeight: '700', color: Colors.gray[700] },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },

  zoneCityBlock: { marginTop: Spacing.md },
  zoneCityLabel: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
    color: Colors.gray[400],
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  zoneChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  zoneChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    backgroundColor: Colors.white,
  },
  zoneChipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  zoneChipText: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.gray[600] },
  zoneChipTextActive: { color: Colors.white },
});
