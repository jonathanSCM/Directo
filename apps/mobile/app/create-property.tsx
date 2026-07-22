import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
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
import { useAuth } from '../src/context/AuthContext';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';
import api from '../src/services/api';
import SubscriptionGate from '../src/components/subscription/SubscriptionGate';
import ExtraPropertyPaymentModal from '../src/components/subscription/ExtraPropertyPaymentModal';

interface CatalogItem {
  id: string;
  name: string;
  slug: string;
}

interface Zone {
  id: string;
  name: string;
  city: string;
}

interface Amenity {
  id: string;
  name: string;
  slug: string;
  icon: string;
  category: string;
}

const AMENITY_ICONS: Record<string, string> = {
  bed: 'bed-outline', snow: 'snow-outline', flame: 'flame-outline',
  wifi: 'wifi-outline', water: 'water-outline', restaurant: 'restaurant-outline',
  shirt: 'shirt-outline', leaf: 'leaf-outline', sunny: 'sunny-outline',
  umbrella: 'umbrella-outline', bonfire: 'bonfire-outline', car: 'car-outline',
  'car-sport': 'car-sport-outline', 'arrow-up': 'arrow-up-outline',
  'shield-checkmark': 'shield-checkmark-outline', person: 'person-outline',
  barbell: 'barbell-outline', football: 'football-outline', people: 'people-outline',
  paw: 'paw-outline', briefcase: 'briefcase-outline', star: 'star-outline',
};

const CATEGORY_LABELS: Record<string, string> = {
  interior: 'Interior', exterior: 'Exterior', estacionamiento: 'Estacionamiento',
  edificio: 'Edificio', politicas: 'Políticas', general: 'General',
};

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

// Wizard de 5 pasos: menos abrumador que un formulario largo de una sola vez.
const STEPS = [
  { key: 'type', title: '¿Qué vas a publicar?', subtitle: 'Elige el tipo de operación y de inmueble' },
  { key: 'details', title: 'Cuéntanos de tu propiedad', subtitle: 'Título, precio y una buena descripción venden más rápido' },
  { key: 'location', title: '¿Dónde está ubicada?', subtitle: 'Ayuda a los interesados a encontrarla en el mapa' },
  { key: 'photos', title: 'Fotos y amenidades', subtitle: 'Las propiedades con fotos reciben muchas más consultas' },
  { key: 'contact', title: 'Contacto', subtitle: 'Por dónde te van a escribir los interesados' },
] as const;

export default function CreatePropertyScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState(0);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [operation, setOperation] = useState('sale');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [address, setAddress] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [useCustomPhone, setUseCustomPhone] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [propertyTypeId, setPropertyTypeId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [propertyTypes, setPropertyTypes] = useState<CatalogItem[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(new Set());
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showZonePicker, setShowZonePicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSubGate, setShowSubGate] = useState(false);
  const [subGateReason, setSubGateReason] = useState<'no_subscription' | 'limit_reached'>('no_subscription');
  const [extraCharge, setExtraCharge] = useState<{ id: string; title: string; amount: number; currency: string; paymentId?: string } | null>(null);

  const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ description: string; lat: number; lng: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);
  const scrollRef = useRef<ScrollView>(null);

  const toggleAmenity = (id: string) => {
    setSelectedAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    api.get('/property-types').then((r) => setPropertyTypes(r.data)).catch(() => {});
    api.get('/zones').then((r) => setZones(r.data)).catch(() => {});
    api.get('/amenities').then((r) => setAmenities(r.data)).catch(() => {});
  }, []);

  const selectedType = propertyTypes.find((t) => t.id === propertyTypeId);
  const selectedZone = zones.find((z) => z.id === zoneId);

  const pickImages = async () => {
    if (selectedImages.length >= 10) {
      Alert.alert('Límite', 'Máximo 10 fotos por propiedad');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10 - selectedImages.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      setSelectedImages((prev) => [...prev, ...result.assets].slice(0, 10));
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Validación por paso: solo lo esencial bloquea avanzar.
  const stepValid = [
    !!propertyTypeId,
    title.trim().length >= 5 && !!price,
    true,
    true,
    true,
  ];
  const canSubmit = stepValid[0] && stepValid[1];

  const goNext = () => {
    if (!stepValid[step]) {
      const msg = step === 0 ? 'Elige el tipo de inmueble' : 'Escribe un título de al menos 5 letras y un precio';
      Alert.alert('Falta un dato', msg);
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } else {
      router.canGoBack() ? router.back() : router.replace('/(tabs)/saved');
    }
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
      if (selectedAmenities.size > 0) {
        body.amenity_ids = Array.from(selectedAmenities);
      }

      const { data: created } = await api.post('/properties', body);

      if (selectedImages.length > 0) {
        const formData = new FormData();
        selectedImages.forEach((img) => {
          const ext = img.uri.split('.').pop() ?? 'jpg';
          formData.append('files', {
            uri: img.uri,
            type: img.mimeType ?? `image/${ext}`,
            name: img.fileName ?? `photo.${ext}`,
          } as any);
        });
        await api.post(`/properties/${created.id}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Envía la propiedad a revisión/publicación (puede quedar en pausa si supera el límite del plan).
      const { data: published } = await api.patch(`/properties/${created.id}/publish`);
      const finalStatus = published.status;

      if (finalStatus === 'paused') {
        try {
          const { data: elig } = await api.get(`/properties/${created.id}/extra-charge-eligibility`);
          if (elig.eligible) {
            setExtraCharge({
              id: created.id,
              title: title.trim(),
              amount: elig.amount,
              currency: elig.currency,
              paymentId: elig.pending ? elig.paymentId : undefined,
            });
            setSaving(false);
            return;
          }
        } catch {}
      }

      const message =
        finalStatus === 'paused'
          ? 'Tu propiedad fue aprobada, pero quedó en pausa porque supera el límite de tu plan. Amplía tu plan para publicarla.'
          : finalStatus === 'published'
          ? 'Tu propiedad ya está publicada.'
          : 'Tu propiedad fue enviada para revisión. Aparecerá publicada una vez aprobada.';

      Alert.alert('¡Listo! 🎉', message, [
        { text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/saved')) },
      ]);
    } catch (e: any) {
      const msg = e.response?.data?.message;
      const msgStr = typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : '';
      const status = e.response?.status;
      if (status === 403 && (msgStr.includes('suscripción') || msgStr.includes('subscription'))) {
        setSubGateReason(msgStr.includes('límite') || msgStr.includes('limit') ? 'limit_reached' : 'no_subscription');
        setShowSubGate(true);
      } else {
        Alert.alert('Error', msgStr || 'No se pudo crear la propiedad');
      }
    } finally {
      setSaving(false);
    }
  }, [canSubmit, title, description, operation, price, currency, propertyTypeId, zoneId, address, bedrooms, bathrooms, areaSqm, useCustomPhone, whatsapp, user?.phone, latitude, longitude, selectedAmenities, selectedImages, router]);

  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(query + ', Santa Cruz, Bolivia');
      setSearchResults(results.slice(0, 5).map((r) => ({ description: query, lat: r.latitude, lng: r.longitude })));
    } catch {}
    setSearching(false);
  }, []);

  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => searchAddress(text), 600);
  };

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const { data } = await api.get('/geocoding/reverse', { params: { lat, lng } });
      if (data.formatted_address) setAddress(data.formatted_address);
      if (data.zone_id) setZoneId(data.zone_id);
    } catch {}
  }, []);

  const updateLocation = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  const selectSearchResult = (lat: number, lng: number) => {
    updateLocation(lat, lng);
    setSearchResults([]); setSearchQuery('');
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500);
  };

  const useCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Necesitamos acceso a tu ubicación'); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    updateLocation(loc.coords.latitude, loc.coords.longitude);
    mapRef.current?.animateToRegion({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 500);
  };

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Publicar propiedad</Text>
        <Text style={styles.stepCounter}>{step + 1}/{STEPS.length}</Text>
      </View>

      {/* Barra de progreso */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>{current.title}</Text>
        <Text style={styles.stepSubtitle}>{current.subtitle}</Text>

        {step === 0 && (
          <>
            <Text style={styles.label}>Tipo de operación</Text>
            <View style={styles.opRow}>
              {OPERATIONS.map((op) => (
                <TouchableOpacity
                  key={op.key}
                  style={[
                    styles.opChip,
                    operation === op.key && { backgroundColor: op.color, borderColor: op.color },
                  ]}
                  onPress={() => setOperation(op.key)}
                >
                  <Ionicons
                    name={op.icon as any}
                    size={16}
                    color={operation === op.key ? Colors.white : Colors.gray[500]}
                  />
                  <Text
                    style={[
                      styles.opChipText,
                      operation === op.key && { color: Colors.white },
                    ]}
                  >
                    {op.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Tipo de inmueble *</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setShowTypePicker(true)}
            >
              <Text style={selectedType ? styles.pickerText : styles.pickerPlaceholder}>
                {selectedType?.name ?? 'Seleccionar tipo'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.gray[400]} />
            </TouchableOpacity>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej: Casa amplia en Equipetrol"
              placeholderTextColor={Colors.gray[400]}
              maxLength={200}
            />

            <Text style={styles.label}>Precio *</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={price}
                onChangeText={setPrice}
                placeholder="120000"
                placeholderTextColor={Colors.gray[400]}
                keyboardType="numeric"
              />
              <View style={styles.currencyToggle}>
                {CURRENCIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.currBtn, currency === c && styles.currBtnActive]}
                    onPress={() => setCurrency(c)}
                  >
                    <Text style={[styles.currText, currency === c && styles.currTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe tu propiedad: qué la hace especial, el barrio, cercanías..."
              placeholderTextColor={Colors.gray[400]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Características</Text>
            <View style={styles.specsRow}>
              <View style={styles.specField}>
                <Text style={styles.specLabel}>Dormitorios</Text>
                <TextInput
                  style={styles.specInput}
                  value={bedrooms}
                  onChangeText={setBedrooms}
                  placeholder="3"
                  placeholderTextColor={Colors.gray[400]}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.specField}>
                <Text style={styles.specLabel}>Baños</Text>
                <TextInput
                  style={styles.specInput}
                  value={bathrooms}
                  onChangeText={setBathrooms}
                  placeholder="2"
                  placeholderTextColor={Colors.gray[400]}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.specField}>
                <Text style={styles.specLabel}>Área m²</Text>
                <TextInput
                  style={styles.specInput}
                  value={areaSqm}
                  onChangeText={setAreaSqm}
                  placeholder="180"
                  placeholderTextColor={Colors.gray[400]}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.label}>Dirección</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Av. San Martín #123"
              placeholderTextColor={Colors.gray[400]}
            />

            <Text style={styles.label}>Ubicación en el mapa</Text>
            <TouchableOpacity style={styles.mapPickerBtn} onPress={() => setShowMapPicker(true)}>
              <Ionicons name="location" size={20} color={latitude ? Colors.primary : Colors.gray[400]} />
              <Text style={[latitude ? styles.pickerText : styles.pickerPlaceholder, { flex: 1 }]}>
                {latitude ? `${latitude.toFixed(5)}, ${longitude!.toFixed(5)}` : 'Toca para elegir en el mapa'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
            </TouchableOpacity>

            <Text style={styles.label}>Zona</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setShowZonePicker(true)}
            >
              <Text style={selectedZone ? styles.pickerText : styles.pickerPlaceholder}>
                {selectedZone ? `${selectedZone.name}, ${selectedZone.city}` : 'Seleccionar zona'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.gray[400]} />
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.label}>Fotos ({selectedImages.length}/10)</Text>
            <View style={styles.imagesRow}>
              {selectedImages.map((img, idx) => (
                <View key={idx} style={styles.imageThumb}>
                  <Image source={{ uri: img.uri }} style={styles.thumbImg} />
                  <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(idx)}>
                    <Ionicons name="close-circle" size={22} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {selectedImages.length < 10 && (
                <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
                  <Ionicons name="camera-outline" size={28} color={Colors.gray[400]} />
                  <Text style={styles.addImageText}>Añadir</Text>
                </TouchableOpacity>
              )}
            </View>

            {amenities.length > 0 && (
              <>
                <Text style={[styles.label, { marginTop: Spacing.xl }]}>Amenidades</Text>
                <Text style={styles.sectionHint}>Selecciona las que apliquen (opcional)</Text>
                {Object.entries(
                  amenities.reduce<Record<string, Amenity[]>>((acc, a) => {
                    (acc[a.category] ??= []).push(a);
                    return acc;
                  }, {}),
                ).map(([cat, items]) => (
                  <View key={cat} style={styles.amenityCatBlock}>
                    <Text style={styles.amenityCatLabel}>{CATEGORY_LABELS[cat] ?? cat}</Text>
                    <View style={styles.amenityGrid}>
                      {items.map((a) => {
                        const selected = selectedAmenities.has(a.id);
                        return (
                          <TouchableOpacity
                            key={a.id}
                            style={[styles.amenityChip, selected && styles.amenityChipSelected]}
                            onPress={() => toggleAmenity(a.id)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={(AMENITY_ICONS[a.icon] ?? 'star-outline') as any}
                              size={16}
                              color={selected ? Colors.primary : Colors.gray[400]}
                            />
                            <Text style={[styles.amenityChipText, selected && styles.amenityChipTextSelected]}>
                              {a.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.label}>WhatsApp de contacto</Text>
            {user?.phone ? (
              <>
                <View style={styles.phoneToggle}>
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
              <TextInput
                style={styles.input}
                value={whatsapp}
                onChangeText={setWhatsapp}
                placeholder="+591 70000000"
                placeholderTextColor={Colors.gray[400]}
                keyboardType="phone-pad"
              />
            )}

            {/* Resumen rápido */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle} numberOfLines={1}>{title || 'Sin título'}</Text>
              <Text style={styles.summaryPrice}>
                {price ? `${currency === 'USD' ? '$' : 'Bs.'} ${Number(price).toLocaleString()}` : 'Sin precio'}
              </Text>
              <View style={styles.summaryRow}>
                <Ionicons name="pricetag-outline" size={14} color={Colors.gray[500]} />
                <Text style={styles.summaryText}>
                  {OPERATIONS.find((o) => o.key === operation)?.label} · {selectedType?.name ?? 'Sin tipo'}
                </Text>
              </View>
              {selectedZone && (
                <View style={styles.summaryRow}>
                  <Ionicons name="location-outline" size={14} color={Colors.gray[500]} />
                  <Text style={styles.summaryText}>{selectedZone.name}, {selectedZone.city}</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Ionicons name="image-outline" size={14} color={Colors.gray[500]} />
                <Text style={styles.summaryText}>{selectedImages.length} foto(s)</Text>
              </View>
            </View>

            <Text style={styles.hint}>
              Tu propiedad será revisada antes de publicarse. Necesitas una suscripción activa.
            </Text>
          </>
        )}
      </ScrollView>

      {/* Footer de navegación */}
      <View style={styles.footer}>
        {isLastStep ? (
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving || !canSubmit}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="cloud-upload" size={20} color={Colors.white} />
            )}
            <Text style={styles.submitBtnText}>{saving ? 'Publicando...' : 'Publicar propiedad'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
            <Text style={styles.nextBtnText}>Siguiente</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

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
            <TextInput style={styles.searchInput} value={searchQuery} onChangeText={onSearchChange} placeholder="Buscar dirección..." placeholderTextColor={Colors.gray[400]} />
            {searching && <ActivityIndicator size="small" color={Colors.primary} />}
          </View>
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((r, i) => (
                <TouchableOpacity key={i} style={styles.searchResultItem} onPress={() => selectSearchResult(r.lat, r.lng)}>
                  <Ionicons name="location-outline" size={18} color={Colors.primary} />
                  <Text style={styles.searchResultText} numberOfLines={2}>{r.description} ({r.lat.toFixed(4)}, {r.lng.toFixed(4)})</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={latitude && longitude ? { latitude, longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 } : SCZ_REGION}
            onPress={(e) => updateLocation(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
            onLongPress={(e) => updateLocation(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
          >
            {latitude != null && longitude != null && (
              <Marker coordinate={{ latitude, longitude }} draggable onDragEnd={(e) => updateLocation(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)} />
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

      {/* Type picker modal */}
      <PickerModal
        visible={showTypePicker}
        title="Tipo de inmueble"
        items={propertyTypes.map((t) => ({ id: t.id, label: t.name }))}
        selectedId={propertyTypeId}
        onSelect={(id) => { setPropertyTypeId(id); setShowTypePicker(false); }}
        onClose={() => setShowTypePicker(false)}
      />

      {/* Zone picker modal */}
      <PickerModal
        visible={showZonePicker}
        title="Zona"
        items={zones.map((z) => ({ id: z.id, label: `${z.name}, ${z.city}` }))}
        selectedId={zoneId}
        onSelect={(id) => { setZoneId(id); setShowZonePicker(false); }}
        onClose={() => setShowZonePicker(false)}
      />
      <SubscriptionGate
        visible={showSubGate}
        onClose={() => setShowSubGate(false)}
        reason={subGateReason}
      />
      <ExtraPropertyPaymentModal
        visible={!!extraCharge}
        propertyId={extraCharge?.id ?? null}
        propertyTitle={extraCharge?.title}
        amount={extraCharge?.amount}
        currency={extraCharge?.currency}
        resumePaymentId={extraCharge?.paymentId ?? null}
        onClose={() => {
          setExtraCharge(null);
          router.canGoBack() ? router.back() : router.replace('/(tabs)/saved');
        }}
        onPaid={() => {}}
      />
    </KeyboardAvoidingView>
  );
}

function PickerModal({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: { id: string; label: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.gray[600]} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 350 }}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.modalItem,
                  selectedId === item.id && styles.modalItemActive,
                ]}
                onPress={() => onSelect(item.id)}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    selectedId === item.id && styles.modalItemTextActive,
                  ]}
                >
                  {item.label}
                </Text>
                {selectedId === item.id && (
                  <Ionicons name="checkmark" size={20} color={Colors.primary} />
                )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  stepCounter: { width: 40, textAlign: 'right', fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[400] },
  progressTrack: { height: 3, backgroundColor: Colors.gray[100] },
  progressFill: { height: 3, backgroundColor: Colors.primary },
  content: { padding: Spacing.xxl, paddingBottom: 40 },
  stepTitle: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.gray[900], marginBottom: 4 },
  stepSubtitle: { fontSize: Fonts.sizes.sm, color: Colors.gray[500], marginBottom: Spacing.xl, lineHeight: 20 },
  sectionTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: Colors.gray[800],
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  opRow: { flexDirection: 'row', gap: Spacing.sm },
  opChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
  },
  opChipText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[600] },
  label: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.gray[700],
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontSize: Fonts.sizes.md,
    color: Colors.gray[900],
  },
  textArea: { minHeight: 100 },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  pickerText: { fontSize: Fonts.sizes.md, color: Colors.gray[900] },
  pickerPlaceholder: { fontSize: Fonts.sizes.md, color: Colors.gray[400] },
  priceRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  currencyToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.gray[100],
    borderRadius: Radius.md,
    padding: 3,
  },
  currBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.sm },
  currBtnActive: { backgroundColor: Colors.primary },
  currText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[600] },
  currTextActive: { color: Colors.white },
  specsRow: { flexDirection: 'row', gap: Spacing.md },
  specField: { flex: 1 },
  specLabel: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginBottom: Spacing.xs },
  specInput: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: Fonts.sizes.md,
    color: Colors.gray[900],
    textAlign: 'center',
  },
  phoneToggle: {
    gap: Spacing.sm,
  },
  phoneOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
  },
  phoneOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  phoneOptionText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.gray[600],
  },
  phoneOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  imageThumb: { width: 90, height: 90, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  thumbImg: { width: '100%', height: '100%' },
  removeImgBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: Colors.white, borderRadius: 11 },
  addImageBtn: { width: 90, height: 90, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.gray[200], borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 4 },
  addImageText: { fontSize: Fonts.sizes.xs, color: Colors.gray[400] },
  footer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    backgroundColor: Colors.white,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: Radius.lg,
  },
  nextBtnText: { color: Colors.white, fontSize: Fonts.sizes.md, fontWeight: '700' },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: Radius.lg,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: Colors.white, fontSize: Fonts.sizes.md, fontWeight: '700' },
  hint: {
    fontSize: Fonts.sizes.xs,
    color: Colors.gray[400],
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  summaryCard: {
    backgroundColor: Colors.gray[50],
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
    gap: 6,
  },
  summaryTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.gray[900] },
  summaryPrice: { fontSize: Fonts.sizes.lg, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryText: { fontSize: Fonts.sizes.sm, color: Colors.gray[600] },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray[300],
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  modalItemActive: { backgroundColor: Colors.primaryLight, marginHorizontal: -Spacing.xxl, paddingHorizontal: Spacing.xxl },
  modalItemText: { fontSize: Fonts.sizes.md, color: Colors.gray[700] },
  modalItemTextActive: { color: Colors.primary, fontWeight: '600' },
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
  sectionHint: { fontSize: Fonts.sizes.xs, color: Colors.gray[400], marginBottom: Spacing.md, marginTop: -Spacing.sm },
  amenityCatBlock: { marginBottom: Spacing.md },
  amenityCatLabel: { fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.gray[500], textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  amenityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.gray[200],
    backgroundColor: Colors.white,
  },
  amenityChipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  amenityChipText: { fontSize: Fonts.sizes.sm, color: Colors.gray[500] },
  amenityChipTextSelected: { color: Colors.primary, fontWeight: '600' },
});
