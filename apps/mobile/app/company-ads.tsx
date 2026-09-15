import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { guessImageMimeType } from '../src/utils/mime';

interface Ad {
  id: string;
  title: string;
  link_url: string | null;
  image_url: string;
  status: 'active' | 'paused' | 'pending_review';
  views_used: number;
  clicks_used: number;
}

interface Company {
  id: string;
  name: string;
  website: string | null;
  logo_url: string | null;
  ads: Ad[];
}

const STATUS_LABEL: Record<Ad['status'], { label: string; color: string }> = {
  pending_review: { label: 'En revisión', color: '#F59E0B' },
  active: { label: 'Activo', color: Colors.success },
  paused: { label: 'Pausado', color: Colors.gray[400] },
};

export default function CompanyAdsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');

  const [showAdForm, setShowAdForm] = useState(false);
  const [adTitle, setAdTitle] = useState('');
  const [adLink, setAdLink] = useState('');
  const [adImage, setAdImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/companies/mine');
      setCompany(data);
      if (data) {
        setCompanyName(data.name);
        setCompanyWebsite(data.website ?? '');
      }
    } catch {
      // sin empresa todavía, o error de red — se muestra el form de creación
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveCompany = async () => {
    if (!companyName.trim()) {
      Alert.alert('Falta el nombre', 'Poné el nombre de tu empresa.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/companies', {
        name: companyName.trim(),
        website: companyWebsite.trim() || undefined,
      });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'No se pudo guardar la empresa');
    }
    setSaving(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setAdImage(result.assets[0]);
  };

  const createAd = async () => {
    if (!adTitle.trim()) {
      Alert.alert('Falta el título', 'Ponele un título a tu anuncio.');
      return;
    }
    if (!adImage) {
      Alert.alert('Falta la imagen', 'Elegí una imagen para tu anuncio.');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', adTitle.trim());
      if (adLink.trim()) formData.append('link_url', adLink.trim());
      const ext = adImage.uri.split('.').pop() ?? 'jpg';
      formData.append('image', {
        uri: adImage.uri,
        type: guessImageMimeType(adImage.uri, adImage.mimeType),
        name: adImage.fileName ?? `ad.${ext}`,
      } as any);
      await api.post('/companies/mine/ads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowAdForm(false);
      setAdTitle('');
      setAdLink('');
      setAdImage(null);
      Alert.alert('Listo', 'Tu anuncio quedó en revisión — se muestra apenas lo aprobemos.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'No se pudo crear el anuncio');
    }
    setSaving(false);
  };

  const toggleAdStatus = async (ad: Ad) => {
    if (ad.status === 'pending_review') return;
    try {
      await api.patch(`/companies/mine/ads/${ad.id}/status`, {
        status: ad.status === 'active' ? 'paused' : 'active',
      });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'No se pudo cambiar el estado');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.header}>Mi empresa y publicidad</Text>
      </View>

      {!company ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Creá tu empresa</Text>
          <Text style={styles.cardHint}>
            Con esto vas a poder subir tus propios anuncios (banners y popups) en DIRECTO.
          </Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nombre de la empresa</Text>
            <TextInput
              style={styles.input}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Ej. Constructora Andina"
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Sitio web (opcional)</Text>
            <TextInput
              style={styles.input}
              value={companyWebsite}
              onChangeText={setCompanyWebsite}
              placeholder="https://miempresa.com"
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={saveCompany} disabled={saving}>
            <Text style={styles.primaryBtnText}>{saving ? 'Guardando...' : 'Crear empresa'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{company.name}</Text>
            {company.website && <Text style={styles.cardHint}>{company.website}</Text>}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mis anuncios</Text>
            <TouchableOpacity onPress={() => setShowAdForm((v) => !v)}>
              <Text style={styles.link}>{showAdForm ? 'Cancelar' : '+ Nuevo anuncio'}</Text>
            </TouchableOpacity>
          </View>

          {showAdForm && (
            <View style={styles.card}>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {adImage ? (
                  <Image source={{ uri: adImage.uri }} style={styles.imagePreview} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={28} color={Colors.gray[400]} />
                    <Text style={styles.cardHint}>Elegir imagen</Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Título</Text>
                <TextInput
                  style={styles.input}
                  value={adTitle}
                  onChangeText={setAdTitle}
                  placeholder="Ej. Departamentos en preventa"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Link (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={adLink}
                  onChangeText={setAdLink}
                  placeholder="https://miempresa.com/promo"
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={createAd} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? 'Subiendo...' : 'Enviar a revisión'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {company.ads.length === 0 && !showAdForm && (
            <Text style={styles.cardHint}>Todavía no cargaste ningún anuncio.</Text>
          )}

          {company.ads.map((ad) => (
            <View key={ad.id} style={styles.adRow}>
              <Image source={{ uri: getImageUrl(ad.image_url) ?? undefined }} style={styles.adThumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.adTitle}>{ad.title}</Text>
                <Text style={[styles.adStatus, { color: STATUS_LABEL[ad.status].color }]}>
                  {STATUS_LABEL[ad.status].label}
                </Text>
                <Text style={styles.cardHint}>
                  {ad.views_used} vistas · {ad.clicks_used} clics
                </Text>
              </View>
              {ad.status !== 'pending_review' && (
                <TouchableOpacity onPress={() => toggleAdStatus(ad)}>
                  <Text style={styles.link}>{ad.status === 'active' ? 'Pausar' : 'Activar'}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  header: { flex: 1, fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.gray[900] },
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gray[100],
  },
  cardTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  cardHint: { fontSize: Fonts.sizes.sm, color: Colors.gray[500], marginTop: 4 },
  formGroup: { marginTop: Spacing.md },
  label: { fontSize: Fonts.sizes.sm, color: Colors.gray[600], marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Fonts.sizes.md,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.md },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.gray[900] },
  link: { color: Colors.primary, fontWeight: '600', fontSize: Fonts.sizes.sm },
  imagePicker: {
    height: 120,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  imagePreview: { width: '100%', height: '100%' },
  adRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.gray[50],
  },
  adThumb: { width: 64, height: 44, borderRadius: 6, backgroundColor: Colors.gray[100] },
  adTitle: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[900] },
  adStatus: { fontSize: Fonts.sizes.xs, fontWeight: '700', marginTop: 2 },
});
