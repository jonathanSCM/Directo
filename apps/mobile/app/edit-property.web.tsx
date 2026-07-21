import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import L from 'leaflet';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { getImageUrl } from '../src/constants/api';
import { useAuth } from '../src/context/AuthContext';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';
import api from '../src/services/api';

function useLeafletCSS() {
  useEffect(() => {
    if (document.getElementById('leaflet-css')) return;
    const link = document.createElement('link');
    link.id = 'leaflet-css'; link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }, []);
}

const PIN_ICON = L.icon({
  iconUrl: '/markers/marker-active.png',
  iconSize: [36, 48], iconAnchor: [18, 48], popupAnchor: [0, -48],
});

function MapClickHandler({ onPress }: { onPress: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPress(e.latlng.lat, e.latlng.lng) });
  return null;
}

function MapFly({ coord }: { coord: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (coord) map.flyTo(coord, Math.max(map.getZoom(), 16), { duration: 0.5 }); }, [coord]);
  return null;
}

function MapResizer({ trigger }: { trigger: boolean }) {
  const map = useMap();
  useEffect(() => { if (trigger) setTimeout(() => map.invalidateSize(), 100); }, [trigger]);
  return null;
}

const SCZ: [number, number] = [-17.7833, -63.1821];
const OPERATIONS = [
  { key: 'sale', label: 'Venta', icon: 'pricetag', color: '#F59E0B' },
  { key: 'rent', label: 'Alquiler', icon: 'time', color: '#EF4444' },
  { key: 'anticretico', label: 'Anticrético', icon: 'swap-horizontal', color: '#22C55E' },
];
const CURRENCIES = ['USD', 'BOB'];
interface CatalogItem { id: string; name: string; slug: string }
interface Zone { id: string; name: string; city: string }

export default function EditPropertyWeb() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  useLeafletCSS();

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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [existingImages, setExistingImages] = useState<{ id: string; url: string; is_main: boolean }[]>([]);
  const [newImages, setNewImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ description: string; lat: number; lng: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/property-types').then((r) => setPropertyTypes(r.data)),
      api.get('/zones').then((r) => setZones(r.data)),
      api.get(`/properties/by-id/${id}`).then((r) => {
        const p = r.data;
        setTitle(p.title ?? ''); setDescription(p.description ?? '');
        setOperation(p.operation ?? 'sale'); setPrice(String(Number(p.price) || ''));
        setCurrency(p.currency ?? 'USD'); setAddress(p.address ?? '');
        setBedrooms(p.bedrooms != null ? String(p.bedrooms) : '');
        setBathrooms(p.bathrooms != null ? String(p.bathrooms) : '');
        setAreaSqm(p.area_m2 != null ? String(Number(p.area_m2)) : '');
        const propPhone = p.whatsapp ?? '';
        setWhatsapp(propPhone);
        if (propPhone && propPhone !== user?.phone) setUseCustomPhone(true);
        setPropertyTypeId(p.property_type_id ?? '');
        setZoneId(p.zone_id ?? '');
        if (p.latitude != null && p.longitude != null) {
          setLatitude(Number(p.latitude)); setLongitude(Number(p.longitude));
        }
        if (p.property_images?.length) {
          setExistingImages(p.property_images.map((img: any) => ({ id: img.id, url: img.url, is_main: img.is_main })));
        }
      }),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const selectedType = propertyTypes.find((t) => t.id === propertyTypeId);
  const selectedZone = zones.find((z) => z.id === zoneId);
  const totalImages = existingImages.length + newImages.length;
  const canSubmit = title.trim().length >= 5 && propertyTypeId && price;

  const pickImages = async () => {
    if (totalImages >= 10) { setError('Máximo 10 fotos por propiedad'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true,
      selectionLimit: 10 - totalImages, quality: 0.8,
    });
    if (!result.canceled) setNewImages((prev) => [...prev, ...result.assets].slice(0, 10 - existingImages.length));
  };

  const removeExistingImage = async (imageId: string) => {
    try {
      await api.delete(`/properties/${id}/images/${imageId}`);
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch { setError('No se pudo eliminar la imagen'); }
  };

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) { setError('Completa al menos el título, tipo de propiedad y precio'); return; }
    setSaving(true); setError('');
    try {
      const body: Record<string, any> = {
        title: title.trim(), operation, price: Number(price), currency,
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
      if (latitude != null && longitude != null) { body.latitude = latitude; body.longitude = longitude; }

      await api.patch(`/properties/${id}`, body);

      if (newImages.length > 0) {
        const formData = new FormData();
        for (const img of newImages) {
          const resp = await fetch(img.uri);
          const blob = await resp.blob();
          formData.append('files', blob, img.fileName ?? 'photo.jpg');
        }
        await api.post(`/properties/${id}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setSuccess('La propiedad fue actualizada correctamente.');
      setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/saved')), 2000);
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setError(typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : 'No se pudo actualizar');
    } finally { setSaving(false); }
  }, [canSubmit, title, description, operation, price, currency, propertyTypeId, zoneId, address, bedrooms, bathrooms, areaSqm, whatsapp, latitude, longitude, id, newImages, useCustomPhone, user?.phone]);

  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Santa Cruz, Bolivia')}&format=json&limit=5`,
      );
      const data = await res.json();
      setSearchResults(data.map((r: any) => ({
        description: r.display_name.split(',').slice(0, 3).join(','),
        lat: parseFloat(r.lat), lng: parseFloat(r.lon),
      })));
    } catch {}
    setSearching(false);
  }, []);

  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => searchAddress(text), 600);
  };

  const selectSearchResult = (lat: number, lng: number) => {
    setLatitude(lat); setLongitude(lng);
    setSearchResults([]); setSearchQuery('');
    setFlyTarget([lat, lng]);
  };

  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Necesitamos acceso a tu ubicación'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude); setLongitude(loc.coords.longitude);
      setFlyTarget([loc.coords.latitude, loc.coords.longitude]);
    } catch { setError('No se pudo obtener tu ubicación'); }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/saved'))} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar propiedad</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError('')}><Ionicons name="close" size={16} color="#DC2626" /></TouchableOpacity>
          </View>
        )}
        {!!success && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" />
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Tipo de operación</Text>
        <View style={styles.opRow}>
          {OPERATIONS.map((op) => (
            <TouchableOpacity key={op.key} style={[styles.opChip, operation === op.key && { backgroundColor: op.color, borderColor: op.color }]} onPress={() => setOperation(op.key)}>
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
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Describe tu propiedad..." placeholderTextColor={Colors.gray[400]} multiline numberOfLines={4} />

        <Text style={styles.label}>Dirección</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Av. San Martín #123" placeholderTextColor={Colors.gray[400]} />

        <Text style={styles.label}>Ubicación en el mapa</Text>
        <TouchableOpacity style={styles.mapPickerBtn} onPress={() => { setShowMapPicker(true); setFlyTarget(null); }}>
          <Ionicons name="location" size={20} color={latitude ? Colors.primary : Colors.gray[400]} />
          <Text style={latitude ? styles.pickerText : styles.pickerPlaceholder}>
            {latitude ? `${latitude.toFixed(5)}, ${longitude!.toFixed(5)}` : 'Seleccionar en mapa'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
        </TouchableOpacity>

        <Text style={styles.label}>Zona</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowZonePicker(true)}>
          <Text style={selectedZone ? styles.pickerText : styles.pickerPlaceholder}>{selectedZone ? `${selectedZone.name}, ${selectedZone.city}` : 'Seleccionar zona'}</Text>
          <Ionicons name="chevron-down" size={18} color={Colors.gray[400]} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Características</Text>
        <View style={styles.specsRow}>
          {([['Dormitorios', bedrooms, setBedrooms, '3'], ['Baños', bathrooms, setBathrooms, '2'], ['Área m²', areaSqm, setAreaSqm, '180']] as const).map(([lbl, val, setter, ph]) => (
            <View key={lbl} style={styles.specField}>
              <Text style={styles.specLabel}>{lbl}</Text>
              <TextInput style={styles.specInput} value={val} onChangeText={setter as any} placeholder={ph} placeholderTextColor={Colors.gray[400]} keyboardType="numeric" />
            </View>
          ))}
        </View>

        <Text style={styles.label}>WhatsApp de contacto</Text>
        {user?.phone ? (
          <>
            <View style={{ gap: Spacing.sm }}>
              {[false, true].map((custom) => (
                <TouchableOpacity key={String(custom)} style={[styles.phoneOption, useCustomPhone === custom && styles.phoneOptionActive]} onPress={() => setUseCustomPhone(custom)}>
                  <Ionicons name={useCustomPhone === custom ? 'radio-button-on' : 'radio-button-off'} size={18} color={useCustomPhone === custom ? Colors.primary : Colors.gray[400]} />
                  <Text style={[styles.phoneOptionText, useCustomPhone === custom && styles.phoneOptionTextActive]}>{custom ? 'Usar otro número' : `Mi teléfono: ${user.phone}`}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {useCustomPhone && <TextInput style={[styles.input, { marginTop: Spacing.sm }]} value={whatsapp} onChangeText={setWhatsapp} placeholder="+591 70000000" placeholderTextColor={Colors.gray[400]} keyboardType="phone-pad" />}
          </>
        ) : (
          <TextInput style={styles.input} value={whatsapp} onChangeText={setWhatsapp} placeholder="+591 70000000" placeholderTextColor={Colors.gray[400]} keyboardType="phone-pad" />
        )}

        <Text style={styles.sectionTitle}>Fotos ({totalImages}/10)</Text>
        <View style={styles.imagesRow}>
          {existingImages.map((img) => (
            <View key={img.id} style={styles.imageThumb}>
              <Image source={{ uri: getImageUrl(img.url)! }} style={styles.thumbImg} />
              <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeExistingImage(img.id)}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </TouchableOpacity>
              {img.is_main && <View style={styles.mainBadge}><Text style={styles.mainBadgeText}>Principal</Text></View>}
            </View>
          ))}
          {newImages.map((img, idx) => (
            <View key={`new-${idx}`} style={styles.imageThumb}>
              <Image source={{ uri: img.uri }} style={styles.thumbImg} />
              <TouchableOpacity style={styles.removeImgBtn} onPress={() => setNewImages((p) => p.filter((_, i) => i !== idx))}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
          {totalImages < 10 && (
            <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
              <Ionicons name="camera-outline" size={28} color={Colors.gray[400]} />
              <Text style={styles.addImageText}>Añadir</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={saving || !canSubmit}>
          {saving ? <ActivityIndicator color={Colors.white} /> : (
            <>
              <Ionicons name="save" size={20} color={Colors.white} />
              <Text style={styles.submitBtnText}>Guardar cambios</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Full-screen map overlay ── */}
      {showMapPicker && (
        <View style={styles.mapOverlay}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowMapPicker(false)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Seleccionar ubicación</Text>
            <TouchableOpacity onPress={() => setShowMapPicker(false)}>
              <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 15 }}>Listo</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mapSearchBar}>
            <Ionicons name="search" size={18} color={Colors.gray[400]} />
            <TextInput style={styles.mapSearchInput} value={searchQuery} onChangeText={onSearchChange} placeholder="Buscar dirección..." placeholderTextColor={Colors.gray[400]} />
            {searching && <ActivityIndicator size="small" color={Colors.primary} />}
          </View>
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((r, i) => (
                <TouchableOpacity key={i} style={styles.searchResultItem} onPress={() => selectSearchResult(r.lat, r.lng)}>
                  <Ionicons name="location-outline" size={16} color={Colors.primary} />
                  <Text style={styles.searchResultText} numberOfLines={2}>{r.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.mapArea}>
            <MapContainer
              center={latitude && longitude ? [latitude, longitude] : SCZ}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <MapClickHandler onPress={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} />
              <MapFly coord={flyTarget} />
              <MapResizer trigger={showMapPicker} />
              {latitude != null && longitude != null && (
                <Marker
                  position={[latitude, longitude]}
                  icon={PIN_ICON}
                  draggable
                  eventHandlers={{
                    dragend: (e: any) => {
                      const pos = e.target.getLatLng();
                      setLatitude(pos.lat); setLongitude(pos.lng);
                    },
                  }}
                />
              )}
            </MapContainer>
          </View>
          {!latitude && (
            <View style={styles.mapHintBar}>
              <Ionicons name="finger-print-outline" size={16} color={Colors.gray[500]} />
              <Text style={styles.mapHintText}>Toca el mapa para marcar la ubicación</Text>
            </View>
          )}
          <View style={styles.mapBottom}>
            {latitude != null ? (
              <View style={styles.coordsBar}>
                <Ionicons name="pin" size={16} color={Colors.primary} />
                <Text style={styles.coordsText}>{latitude.toFixed(6)}, {longitude!.toFixed(6)}</Text>
              </View>
            ) : <View />}
            <TouchableOpacity style={styles.myLocationBtn} onPress={useCurrentLocation}>
              <Ionicons name="navigate" size={18} color={Colors.primary} />
              <Text style={styles.myLocationText}>Mi ubicación</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <PickerModal visible={showTypePicker} title="Tipo de inmueble" items={propertyTypes.map((t) => ({ id: t.id, label: t.name }))} selectedId={propertyTypeId} onSelect={(pid) => { setPropertyTypeId(pid); setShowTypePicker(false); }} onClose={() => setShowTypePicker(false)} />
      <PickerModal visible={showZonePicker} title="Zona" items={zones.map((z) => ({ id: z.id, label: `${z.name}, ${z.city}` }))} selectedId={zoneId} onSelect={(zid) => { setZoneId(zid); setShowZonePicker(false); }} onClose={() => setShowZonePicker(false)} />
    </View>
  );
}

function PickerModal({ visible, title, items, selectedId, onSelect, onClose }: {
  visible: boolean; title: string; items: { id: string; label: string }[];
  selectedId: string; onSelect: (id: string) => void; onClose: () => void;
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  content: { padding: Spacing.xxl, paddingBottom: 60, maxWidth: 680, alignSelf: 'center', width: '100%' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FCA5A5' },
  errorText: { color: '#DC2626', fontSize: 13.5, flex: 1 },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#86EFAC' },
  successText: { color: '#16A34A', fontSize: 13.5, flex: 1 },
  sectionTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.gray[800], marginTop: Spacing.xl, marginBottom: Spacing.md },
  opRow: { flexDirection: 'row', gap: Spacing.sm },
  opChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gray[200], cursor: 'pointer' as any },
  opChipText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[600] },
  label: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[700], marginTop: Spacing.lg, marginBottom: Spacing.sm },
  input: { borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, fontSize: Fonts.sizes.md, color: Colors.gray[900], outlineStyle: 'none' as any },
  textArea: { minHeight: 100 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, cursor: 'pointer' as any },
  pickerText: { fontSize: Fonts.sizes.md, color: Colors.gray[900] },
  pickerPlaceholder: { fontSize: Fonts.sizes.md, color: Colors.gray[400] },
  priceRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  currencyToggle: { flexDirection: 'row', backgroundColor: Colors.gray[100], borderRadius: Radius.md, padding: 3 },
  currBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.sm, cursor: 'pointer' as any },
  currBtnActive: { backgroundColor: Colors.primary },
  currText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[600] },
  currTextActive: { color: Colors.white },
  specsRow: { flexDirection: 'row', gap: Spacing.md },
  specField: { flex: 1 },
  specLabel: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginBottom: Spacing.xs },
  specInput: { borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: Fonts.sizes.md, color: Colors.gray[900], textAlign: 'center', outlineStyle: 'none' as any },
  phoneOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, paddingHorizontal: Spacing.lg, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md, cursor: 'pointer' as any },
  phoneOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  phoneOptionText: { fontSize: Fonts.sizes.sm, color: Colors.gray[600] },
  phoneOptionTextActive: { color: Colors.primary, fontWeight: '600' },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  imageThumb: { width: 90, height: 90, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  thumbImg: { width: '100%', height: '100%' },
  removeImgBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: Colors.white, borderRadius: 11 },
  mainBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(37,99,235,0.8)', paddingVertical: 2, alignItems: 'center' },
  mainBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addImageBtn: { width: 90, height: 90, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gray[200], borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 4, cursor: 'pointer' as any },
  addImageText: { fontSize: Fonts.sizes.xs, color: Colors.gray[400] },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: Radius.lg, marginTop: Spacing.xxl, cursor: 'pointer' as any },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.white, fontSize: Fonts.sizes.md, fontWeight: '700' },
  mapPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, cursor: 'pointer' as any },
  mapOverlay: { position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.white, zIndex: 9999, flexDirection: 'column' },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  mapSearchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.lg, marginVertical: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: Colors.gray[50], borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gray[200] },
  mapSearchInput: { flex: 1, fontSize: Fonts.sizes.md, color: Colors.gray[900], outlineStyle: 'none' as any },
  searchResults: { position: 'absolute' as any, top: 130, left: Spacing.lg, right: Spacing.lg, backgroundColor: Colors.white, borderRadius: Radius.md, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' as any, zIndex: 10000 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray[100], cursor: 'pointer' as any },
  searchResultText: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.gray[700] },
  mapArea: { flex: 1 },
  mapHintBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, backgroundColor: Colors.gray[50], borderTopWidth: 1, borderTopColor: Colors.gray[200] },
  mapHintText: { fontSize: Fonts.sizes.xs, color: Colors.gray[500] },
  mapBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.gray[100] },
  coordsBar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coordsText: { fontSize: Fonts.sizes.sm, color: Colors.gray[600], fontWeight: '500' },
  myLocationBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.white, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.gray[200], cursor: 'pointer' as any },
  myLocationText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.xxl, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.gray[300], alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  modalItemActive: { backgroundColor: Colors.primaryLight, marginHorizontal: -Spacing.xxl, paddingHorizontal: Spacing.xxl },
  modalItemText: { fontSize: Fonts.sizes.md, color: Colors.gray[700] },
  modalItemTextActive: { color: Colors.primary, fontWeight: '600' },
});
