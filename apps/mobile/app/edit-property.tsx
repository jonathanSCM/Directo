import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { getImageUrl } from '../src/constants/api';
import { useAuth } from '../src/context/AuthContext';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';
import api from '../src/services/api';

interface CatalogItem { id: string; name: string; slug: string }
interface Zone { id: string; name: string; city: string }

const OPERATIONS = [
  { key: 'sale', label: 'Venta', icon: 'pricetag', color: '#F59E0B' },
  { key: 'rent', label: 'Alquiler', icon: 'time', color: '#EF4444' },
  { key: 'anticretico', label: 'Anticrético', icon: 'swap-horizontal', color: '#22C55E' },
];
const CURRENCIES = ['USD', 'BOB'];

const SCZ_REGION: Region = {
  latitude: -17.7833,
  longitude: -63.1821,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function EditPropertyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [operation, setOperation] = useState('sale');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [address, setAddress] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [useCustomPhone, setUseCustomPhone] = useState(false);
  const [propertyTypeId, setPropertyTypeId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [propertyTypes, setPropertyTypes] = useState<CatalogItem[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showZonePicker, setShowZonePicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [existingImages, setExistingImages] = useState<{ id: string; url: string; is_main: boolean }[]>([]);
  const [newImages, setNewImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ description: string; lat: number; lng: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    Promise.all([
      api.get('/property-types').then((r) => setPropertyTypes(r.data)),
      api.get('/zones').then((r) => setZones(r.data)),
      api.get(`/properties/by-id/${id}`).then((r) => {
        const p = r.data;
        setTitle(p.title ?? '');
        setDescription(p.description ?? '');
        setOperation(p.operation ?? 'sale');
        setPrice(String(Number(p.price) || ''));
        setCurrency(p.currency ?? 'USD');
        setAddress(p.address ?? '');
        setBedrooms(p.bedrooms != null ? String(p.bedrooms) : '');
        setBathrooms(p.bathrooms != null ? String(p.bathrooms) : '');
        setAreaSqm(p.area_m2 != null ? String(Number(p.area_m2)) : '');
        const propPhone = p.whatsapp ?? '';
        setWhatsapp(propPhone);
        if (propPhone && propPhone !== user?.phone) {
          setUseCustomPhone(true);
        }
        setPropertyTypeId(p.property_type_id ?? '');
        setZoneId(p.zone_id ?? '');
        if (p.latitude != null && p.longitude != null) {
          setLatitude(Number(p.latitude));
          setLongitude(Number(p.longitude));
        }
        if (p.property_images?.length) {
          setExistingImages(p.property_images.map((img: any) => ({
            id: img.id,
            url: img.url,
            is_main: img.is_main,
          })));
        }
      }),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const selectedType = propertyTypes.find((t) => t.id === propertyTypeId);
  const selectedZone = zones.find((z) => z.id === zoneId);
  const totalImages = existingImages.length + newImages.length;
  const canSubmit = title.trim().length >= 5 && propertyTypeId && price;

  const pickImages = async () => {
    if (totalImages >= 5) {
      Alert.alert('Límite', 'Máximo 5 imágenes por propiedad');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - totalImages,
      quality: 0.8,
    });
    if (!result.canceled) {
      setNewImages((prev) => [...prev, ...result.assets].slice(0, 5 - existingImages.length));
    }
  };

  const removeExistingImage = async (imageId: string) => {
    try {
      await api.delete(`/properties/${id}/images/${imageId}`);
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch {
      Alert.alert('Error', 'No se pudo eliminar la imagen');
    }
  };

  const removeNewImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      Alert.alert('Campos requeridos', 'Completa al menos el título, tipo de propiedad y precio');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        title: title.trim(),
        operation,
        price: Number(price),
        currency,
        property_type_id: propertyTypeId,
      };
      if (description.trim()) body.description = description.trim();
      if (address.trim()) body.address = address.trim();
      if (zoneId) body.zone_id = zoneId;
      if (bedrooms) body.bedrooms = Number(bedrooms);
      if (bathrooms) body.bathrooms = Number(bathrooms);
      if (areaSqm) body.area_m2 = Number(areaSqm);
      const phone = useCustomPhone ? whatsapp.trim() : (user?.phone ?? '');
      if (phone) body.whatsapp = phone;
      if (latitude != null && longitude != null) {
        body.latitude = latitude;
        body.longitude = longitude;
      }

      await api.patch(`/properties/${id}`, body);

      if (newImages.length > 0) {
        const formData = new FormData();
        newImages.forEach((img) => {
          const ext = img.uri.split('.').pop() ?? 'jpg';
          formData.append('files', {
            uri: img.uri,
            type: img.mimeType ?? `image/${ext}`,
            name: img.fileName ?? `photo.${ext}`,
          } as any);
        });
        await api.post(`/properties/${id}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      Alert.alert('Guardado', 'La propiedad fue actualizada correctamente.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const msg = e.response?.data?.message;
      Alert.alert('Error', typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : 'No se pudo actualizar');
    } finally {
      setSaving(false);
    }
  }, [canSubmit, title, description, operation, price, currency, propertyTypeId, zoneId, address, bedrooms, bathrooms, areaSqm, whatsapp, latitude, longitude, id, newImages, useCustomPhone, user?.phone]);

  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(query + ', Santa Cruz, Bolivia');
      setSearchResults(
        results.slice(0, 5).map((r) => ({
          description: query,
          lat: r.latitude,
          lng: r.longitude,
        })),
      );
    } catch {}
    setSearching(false);
  }, []);

  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => searchAddress(text), 600);
  };

  const selectSearchResult = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setSearchResults([]);
    setSearchQuery('');
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      500,
    );
  };

  const useCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu ubicación');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLatitude(loc.coords.latitude);
    setLongitude(loc.coords.longitude);
    mapRef.current?.animateToRegion(
      { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      500,
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar propiedad</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Operation */}
        <Text style={styles.sectionTitle}>Tipo de operación</Text>
        <View style={styles.opRow}>
          {OPERATIONS.map((op) => (
            <TouchableOpacity
              key={op.key}
              style={[styles.opChip, operation === op.key && { backgroundColor: op.color, borderColor: op.color }]}
              onPress={() => setOperation(op.key)}
            >
              <Ionicons name={op.icon as any} size={16} color={operation === op.key ? Colors.white : Colors.gray[500]} />
              <Text style={[styles.opChipText, operation === op.key && { color: Colors.white }]}>{op.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Título *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ej: Casa amplia en Equipetrol" placeholderTextColor={Colors.gray[400]} maxLength={200} />

        <Text style={styles.label}>Tipo de inmueble *</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTypePicker(true)}>
          <Text style={selectedType ? styles.pickerText : styles.pickerPlaceholder}>{selectedType?.name ?? 'Seleccionar tipo'}</Text>
          <Ionicons name="chevron-down" size={18} color={Colors.gray[400]} />
        </TouchableOpacity>

        <Text style={styles.label}>Precio *</Text>
        <View style={styles.priceRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={price} onChangeText={setPrice} placeholder="120000" placeholderTextColor={Colors.gray[400]} keyboardType="numeric" />
          <View style={styles.currencyToggle}>
            {CURRENCIES.map((c) => (
              <TouchableOpacity key={c} style={[styles.currBtn, currency === c && styles.currBtnActive]} onPress={() => setCurrency(c)}>
                <Text style={[styles.currText, currency === c && styles.currTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.label}>Descripción</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Describe tu propiedad..." placeholderTextColor={Colors.gray[400]} multiline numberOfLines={4} textAlignVertical="top" />

        <Text style={styles.label}>Dirección</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Av. San Martín #123" placeholderTextColor={Colors.gray[400]} />

        {/* Location map picker */}
        <Text style={styles.label}>Ubicación en el mapa</Text>
        <TouchableOpacity style={styles.mapPickerBtn} onPress={() => setShowMapPicker(true)}>
          <Ionicons name="location" size={20} color={latitude ? Colors.primary : Colors.gray[400]} />
          <Text style={latitude ? styles.pickerText : styles.pickerPlaceholder}>
            {latitude ? `${latitude.toFixed(5)}, ${longitude!.toFixed(5)}` : 'Seleccionar en mapa'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
        </TouchableOpacity>

        <Text style={styles.label}>Zona</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowZonePicker(true)}>
          <Text style={selectedZone ? styles.pickerText : styles.pickerPlaceholder}>
            {selectedZone ? `${selectedZone.name}, ${selectedZone.city}` : 'Seleccionar zona'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={Colors.gray[400]} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Características</Text>
        <View style={styles.specsRow}>
          <View style={styles.specField}>
            <Text style={styles.specLabel}>Dormitorios</Text>
            <TextInput style={styles.specInput} value={bedrooms} onChangeText={setBedrooms} placeholder="3" placeholderTextColor={Colors.gray[400]} keyboardType="numeric" />
          </View>
          <View style={styles.specField}>
            <Text style={styles.specLabel}>Baños</Text>
            <TextInput style={styles.specInput} value={bathrooms} onChangeText={setBathrooms} placeholder="2" placeholderTextColor={Colors.gray[400]} keyboardType="numeric" />
          </View>
          <View style={styles.specField}>
            <Text style={styles.specLabel}>Área m²</Text>
            <TextInput style={styles.specInput} value={areaSqm} onChangeText={setAreaSqm} placeholder="180" placeholderTextColor={Colors.gray[400]} keyboardType="numeric" />
          </View>
        </View>

        <Text style={styles.label}>WhatsApp de contacto</Text>
        {user?.phone ? (
          <>
            <View style={{ gap: Spacing.sm }}>
              <TouchableOpacity
                style={[styles.phoneOption, !useCustomPhone && styles.phoneOptionActive]}
                onPress={() => setUseCustomPhone(false)}
              >
                <Ionicons
                  name={!useCustomPhone ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={!useCustomPhone ? Colors.primary : Colors.gray[400]}
                />
                <Text style={[styles.phoneOptionText, !useCustomPhone && styles.phoneOptionTextActive]}>
                  Mi teléfono: {user.phone}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.phoneOption, useCustomPhone && styles.phoneOptionActive]}
                onPress={() => setUseCustomPhone(true)}
              >
                <Ionicons
                  name={useCustomPhone ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={useCustomPhone ? Colors.primary : Colors.gray[400]}
                />
                <Text style={[styles.phoneOptionText, useCustomPhone && styles.phoneOptionTextActive]}>
                  Usar otro número
                </Text>
              </TouchableOpacity>
            </View>
            {useCustomPhone && (
              <TextInput
                style={[styles.input, { marginTop: Spacing.sm }]}
                value={whatsapp}
                onChangeText={setWhatsapp}
                placeholder="+591 70000000"
                placeholderTextColor={Colors.gray[400]}
                keyboardType="phone-pad"
              />
            )}
          </>
        ) : (
          <TextInput style={styles.input} value={whatsapp} onChangeText={setWhatsapp} placeholder="+591 70000000" placeholderTextColor={Colors.gray[400]} keyboardType="phone-pad" />
        )}

        {/* Images */}
        <Text style={styles.sectionTitle}>Fotos ({totalImages}/5)</Text>
        <View style={styles.imagesRow}>
          {existingImages.map((img) => (
            <View key={img.id} style={styles.imageThumb}>
              <Image source={{ uri: getImageUrl(img.url)! }} style={styles.thumbImg} />
              <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeExistingImage(img.id)}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </TouchableOpacity>
              {img.is_main && (
                <View style={styles.mainBadge}>
                  <Text style={styles.mainBadgeText}>Principal</Text>
                </View>
              )}
            </View>
          ))}
          {newImages.map((img, idx) => (
            <View key={`new-${idx}`} style={styles.imageThumb}>
              <Image source={{ uri: img.uri }} style={styles.thumbImg} />
              <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeNewImage(idx)}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
          {totalImages < 5 && (
            <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
              <Ionicons name="camera-outline" size={28} color={Colors.gray[400]} />
              <Text style={styles.addImageText}>Añadir</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={saving || !canSubmit}>
          <Ionicons name="save" size={20} color={Colors.white} />
          <Text style={styles.submitBtnText}>{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Map picker modal */}
      <Modal visible={showMapPicker} animationType="slide">
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowMapPicker(false)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Seleccionar ubicación</Text>
            <TouchableOpacity onPress={() => setShowMapPicker(false)}>
              <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 15 }}>Listo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.gray[400]} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder="Buscar dirección..."
              placeholderTextColor={Colors.gray[400]}
            />
            {searching && <ActivityIndicator size="small" color={Colors.primary} />}
          </View>

          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((r, i) => (
                <TouchableOpacity key={i} style={styles.searchResultItem} onPress={() => selectSearchResult(r.lat, r.lng)}>
                  <Ionicons name="location-outline" size={18} color={Colors.primary} />
                  <Text style={styles.searchResultText} numberOfLines={2}>
                    {r.description} ({r.lat.toFixed(4)}, {r.lng.toFixed(4)})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={
              latitude && longitude
                ? { latitude, longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }
                : SCZ_REGION
            }
            onPress={(e) => {
              setLatitude(e.nativeEvent.coordinate.latitude);
              setLongitude(e.nativeEvent.coordinate.longitude);
            }}
            onLongPress={(e) => {
              setLatitude(e.nativeEvent.coordinate.latitude);
              setLongitude(e.nativeEvent.coordinate.longitude);
            }}
          >
            {latitude != null && longitude != null && (
              <Marker coordinate={{ latitude, longitude }} draggable onDragEnd={(e) => {
                setLatitude(e.nativeEvent.coordinate.latitude);
                setLongitude(e.nativeEvent.coordinate.longitude);
              }} />
            )}
          </MapView>

          <View style={styles.mapActions}>
            <TouchableOpacity style={styles.myLocationBtn} onPress={useCurrentLocation}>
              <Ionicons name="navigate" size={20} color={Colors.primary} />
              <Text style={styles.myLocationText}>Mi ubicación</Text>
            </TouchableOpacity>
          </View>

          {latitude != null && (
            <View style={styles.coordsBar}>
              <Ionicons name="pin" size={16} color={Colors.primary} />
              <Text style={styles.coordsText}>{latitude.toFixed(6)}, {longitude!.toFixed(6)}</Text>
            </View>
          )}
        </View>
      </Modal>

      <PickerModal visible={showTypePicker} title="Tipo de inmueble" items={propertyTypes.map((t) => ({ id: t.id, label: t.name }))} selectedId={propertyTypeId} onSelect={(pid) => { setPropertyTypeId(pid); setShowTypePicker(false); }} onClose={() => setShowTypePicker(false)} />
      <PickerModal visible={showZonePicker} title="Zona" items={zones.map((z) => ({ id: z.id, label: `${z.name}, ${z.city}` }))} selectedId={zoneId} onSelect={(zid) => { setZoneId(zid); setShowZonePicker(false); }} onClose={() => setShowZonePicker(false)} />
    </KeyboardAvoidingView>
  );
}

function PickerModal({ visible, title, items, selectedId, onSelect, onClose }: {
  visible: boolean; title: string; items: { id: string; label: string }[]; selectedId: string; onSelect: (id: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={Colors.gray[600]} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 350 }}>
            {items.map((item) => (
              <TouchableOpacity key={item.id} style={[styles.modalItem, selectedId === item.id && styles.modalItemActive]} onPress={() => onSelect(item.id)}>
                <Text style={[styles.modalItemText, selectedId === item.id && styles.modalItemTextActive]}>{item.label}</Text>
                {selectedId === item.id && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  content: { padding: Spacing.xxl, paddingBottom: 60 },
  sectionTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.gray[800], marginTop: Spacing.xl, marginBottom: Spacing.md },
  opRow: { flexDirection: 'row', gap: Spacing.sm },
  opChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gray[200] },
  opChipText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[600] },
  label: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[700], marginTop: Spacing.lg, marginBottom: Spacing.sm },
  input: { borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, fontSize: Fonts.sizes.md, color: Colors.gray[900] },
  textArea: { minHeight: 100 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  pickerText: { fontSize: Fonts.sizes.md, color: Colors.gray[900] },
  pickerPlaceholder: { fontSize: Fonts.sizes.md, color: Colors.gray[400] },
  priceRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  currencyToggle: { flexDirection: 'row', backgroundColor: Colors.gray[100], borderRadius: Radius.md, padding: 3 },
  currBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.sm },
  currBtnActive: { backgroundColor: Colors.primary },
  currText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[600] },
  currTextActive: { color: Colors.white },
  specsRow: { flexDirection: 'row', gap: Spacing.md },
  specField: { flex: 1 },
  specLabel: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginBottom: Spacing.xs },
  specInput: { borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: Fonts.sizes.md, color: Colors.gray[900], textAlign: 'center' },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  imageThumb: { width: 90, height: 90, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  thumbImg: { width: '100%', height: '100%' },
  removeImgBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: Colors.white, borderRadius: 11 },
  mainBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(37,99,235,0.8)', paddingVertical: 2 },
  mainBadgeText: { color: Colors.white, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  addImageBtn: { width: 90, height: 90, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gray[200], borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 4 },
  addImageText: { fontSize: Fonts.sizes.xs, color: Colors.gray[400] },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: Radius.lg, marginTop: Spacing.xxl },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.white, fontSize: Fonts.sizes.md, fontWeight: '700' },
  mapPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  mapContainer: { flex: 1, backgroundColor: Colors.white },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.lg, marginVertical: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: Colors.gray[50], borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gray[200] },
  searchInput: { flex: 1, fontSize: Fonts.sizes.md, color: Colors.gray[900], padding: 0 },
  searchResults: { marginHorizontal: Spacing.lg, backgroundColor: Colors.white, borderRadius: Radius.md, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, position: 'absolute', top: 150, left: 0, right: 0, zIndex: 10 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  searchResultText: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.gray[700] },
  map: { flex: 1 },
  mapActions: { position: 'absolute', bottom: 80, right: Spacing.lg },
  myLocationBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.white, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderRadius: Radius.full, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
  myLocationText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.primary },
  coordsBar: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: Spacing.md, backgroundColor: Colors.gray[50], borderTopWidth: 1, borderTopColor: Colors.gray[200] },
  coordsText: { fontSize: Fonts.sizes.sm, color: Colors.gray[600], fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.xxl, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.gray[300], alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  modalItemActive: { backgroundColor: Colors.primaryLight, marginHorizontal: -Spacing.xxl, paddingHorizontal: Spacing.xxl },
  modalItemText: { fontSize: Fonts.sizes.md, color: Colors.gray[700] },
  modalItemTextActive: { color: Colors.primary, fontWeight: '600' },
  phoneToggle: { gap: Spacing.sm, marginTop: Spacing.sm },
  phoneOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gray[200] },
  phoneOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  phoneOptionText: { fontSize: Fonts.sizes.sm, color: Colors.gray[600] },
  phoneOptionTextActive: { color: Colors.primary, fontWeight: '600' },
});
