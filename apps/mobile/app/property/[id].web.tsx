import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import AdSlot from '../../src/components/ads/AdSlot';
import { getImageUrl } from '../../src/constants/api';
import api from '../../src/services/api';
import { Colors, Fonts, Radius, Spacing } from '../../src/constants/theme';

interface PropertyImage { id: string; url: string; is_main: boolean; }
interface PropertyDetail {
  id: string; title: string; slug: string; description: string; address: string;
  price: number; currency: string; operation: string;
  bedrooms?: number; bathrooms?: number; area_m2?: number;
  latitude?: number; longitude?: number; whatsapp?: string; views_count?: number;
  property_images: PropertyImage[];
  property_types?: { name: string; slug: string };
  zones?: { name: string; city: string };
  users?: { name: string; phone?: string; email?: string };
  property_amenities?: { amenities: { id: string; name: string; slug: string; icon: string; category: string } }[];
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

const opLabel = (op: string) => op === 'sale' ? 'Venta' : op === 'rent' ? 'Alquiler' : 'Anticrético';
const opColor = (op: string) => op === 'sale' ? '#F59E0B' : op === 'rent' ? '#EF4444' : '#22C55E';
const formatPrice = (p: number, c: string) => c === 'USD' ? `$${p.toLocaleString()}` : `Bs. ${p.toLocaleString()}`;

// ── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({
  images, startIndex, onClose,
}: {
  images: PropertyImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, images.length - 1));
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, []);

  const prev = () => setIdx(i => Math.max(i - 1, 0));
  const next = () => setIdx(i => Math.min(i + 1, images.length - 1));
  const url = getImageUrl(images[idx].url);

  return (
    <View style={lb.overlay}>
      {/* Backdrop — click to close */}
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

      {/* Close */}
      <TouchableOpacity style={lb.closeBtn} onPress={onClose}>
        <Ionicons name="close" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Counter */}
      <View style={lb.counter}>
        <Text style={lb.counterText}>{idx + 1} / {images.length}</Text>
      </View>

      {/* Image */}
      <View style={lb.imgWrap} pointerEvents="none">
        <Image
          source={{ uri: url! }}
          style={lb.img}
          resizeMode="contain"
        />
      </View>

      {/* Prev */}
      {idx > 0 && (
        <TouchableOpacity style={[lb.arrow, lb.arrowLeft]} onPress={prev}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Next */}
      {idx < images.length - 1 && (
        <TouchableOpacity style={[lb.arrow, lb.arrowRight]} onPress={next}>
          <Ionicons name="chevron-forward" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Dot strip */}
      {images.length > 1 && (
        <View style={lb.dots}>
          {images.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setIdx(i)}>
              <View style={[lb.dot, i === idx && lb.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const lb = StyleSheet.create({
  overlay: {
    position: 'fixed' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.96)',
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute', top: 20, right: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 2, cursor: 'pointer' as any,
  },
  counter: {
    position: 'absolute', top: 24, left: '50%' as any,
    transform: [{ translateX: -30 }],
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, zIndex: 2,
  },
  counterText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  imgWrap: {
    width: '90%' as any,
    height: '80%' as any,
    justifyContent: 'center',
    alignItems: 'center',
  },
  img: { width: '100%', height: '100%' },
  arrow: {
    position: 'absolute', top: '50%' as any,
    transform: [{ translateY: -28 }],
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 2, cursor: 'pointer' as any,
  },
  arrowLeft: { left: 20 },
  arrowRight: { right: 20 },
  dots: {
    position: 'absolute', bottom: 24,
    flexDirection: 'row', gap: 8, zIndex: 2,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
    cursor: 'pointer' as any,
  },
  dotActive: { backgroundColor: '#fff', width: 24 },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function PropertyDetailWeb() {
  const { id: slug } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const viewKey = `viewed_${slug}`;
        const alreadyViewed = await AsyncStorage.getItem(viewKey);
        const { data } = await api.get(`/properties/${slug}`, {
          params: !alreadyViewed ? { track_view: 'true' } : {},
        });
        setProperty({
          ...data,
          latitude: data.latitude ? Number(data.latitude) : null,
          longitude: data.longitude ? Number(data.longitude) : null,
          price: Number(data.price),
          views_count: Number(data.views_count ?? 0),
        });
        if (!alreadyViewed) await AsyncStorage.setItem(viewKey, '1');
      } catch {}
      finally { setLoading(false); }
    })();
  }, [slug]);

  if (loading) {
    return <View style={S.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }
  if (!property) {
    return (
      <View style={S.center}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.gray[300]} />
        <Text style={S.errorText}>Propiedad no encontrada</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
          <Text style={S.backLink}>Volver al mapa</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = property.property_images ?? [];
  const phone = property.whatsapp ?? property.users?.phone;
  const zoneLine = property.zones ? `${property.zones.name}, ${property.zones.city}` : null;
  const location = property.address
    ? (zoneLine ? `${property.address} — ${zoneLine}` : property.address)
    : zoneLine;
  const liked = isFavorite(property.id);
  const mainUrl = images.length > 0 ? getImageUrl(images[activeImg].url) : null;

  const openWhatsApp = () => {
    if (!phone) return;
    Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}?text=Hola, me interesa "${property.title}" en DIRECTO. ¿Está disponible?`);
  };

  return (
    <View style={S.root}>
      {/* Lightbox */}
      {lightboxIdx !== null && images.length > 0 && (
        <Lightbox images={images} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      {/* Top bar */}
      <View style={S.topBar}>
        <TouchableOpacity style={S.topBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Ionicons name="chevron-back" size={22} color={Colors.gray[800]} />
        </TouchableOpacity>
        <View style={S.topRight}>
          <TouchableOpacity style={S.topBtn} onPress={() => Share.share({ message: `${property.title} - ${formatPrice(property.price, property.currency)}` })}>
            <Ionicons name="share-outline" size={20} color={Colors.gray[700]} />
          </TouchableOpacity>
          <TouchableOpacity style={S.topBtn} onPress={() => toggleFavorite(property.id)}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#EF4444' : Colors.gray[700]} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Gallery ── */}
        <View style={S.gallery}>
          {/* Hero */}
          <TouchableOpacity
            style={S.hero}
            activeOpacity={0.92}
            onPress={() => images.length > 0 && setLightboxIdx(activeImg)}
          >
            {mainUrl ? (
              <Image source={{ uri: mainUrl }} style={S.heroImg} resizeMode="cover" />
            ) : (
              <View style={[S.heroImg, S.noImage]}>
                <Ionicons name="image-outline" size={56} color={Colors.gray[300]} />
                <Text style={S.noImageText}>Sin imágenes</Text>
              </View>
            )}
            {images.length > 0 && (
              <View style={S.heroOverlay}>
                <View style={S.expandHint}>
                  <Ionicons name="expand-outline" size={16} color="#fff" />
                  <Text style={S.expandText}>Ver en pantalla completa</Text>
                </View>
                {images.length > 1 && (
                  <View style={S.heroCounter}>
                    <Ionicons name="images-outline" size={14} color="#fff" />
                    <Text style={S.heroCounterText}>{images.length} fotos</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Thumbnails */}
          {images.length > 1 && (
            <View style={S.thumbRow}>
              {images.map((img, i) => {
                const url = getImageUrl(img.url);
                return (
                  <TouchableOpacity
                    key={img.id}
                    style={[S.thumb, activeImg === i && S.thumbActive]}
                    onPress={() => { setActiveImg(i); setLightboxIdx(i); }}
                  >
                    {url ? (
                      <Image source={{ uri: url }} style={S.thumbImg} resizeMode="cover" />
                    ) : (
                      <View style={[S.thumbImg, S.noImage]} />
                    )}
                    {activeImg === i && <View style={S.thumbActiveLine} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Content ── */}
        <View style={S.content}>
          {/* Left column */}
          <View style={S.main}>
            {/* Tags */}
            <View style={S.tags}>
              <View style={[S.opTag, { backgroundColor: opColor(property.operation) }]}>
                <Text style={S.opTagText}>{opLabel(property.operation)}</Text>
              </View>
              {property.property_types && (
                <View style={S.typeTag}><Text style={S.typeTagText}>{property.property_types.name}</Text></View>
              )}
              {!!property.views_count && (
                <View style={S.viewsTag}>
                  <Ionicons name="eye-outline" size={12} color={Colors.gray[500]} />
                  <Text style={S.viewsText}>{property.views_count} visitas</Text>
                </View>
              )}
            </View>

            <Text style={S.title}>{property.title}</Text>
            <View style={S.addrRow}>
              <Ionicons name="location-outline" size={16} color={Colors.gray[400]} />
              <Text style={S.addr}>{location}</Text>
            </View>
            <Text style={S.price}>
              {formatPrice(property.price, property.currency)}
              {property.operation === 'rent' && <Text style={S.perMonth}> /mes</Text>}
            </Text>

            {/* Sin sesión: bloquear el resto del detalle */}
            {!isAuthenticated && (
              <View style={S.loginGate}>
                <Ionicons name="lock-closed" size={40} color={Colors.primary} />
                <Text style={S.loginGateTitle}>Inicia sesión para ver todo</Text>
                <Text style={S.loginGateText}>
                  Detalles completos, amenidades, ubicación y contacto directo con el propietario.
                </Text>
                <TouchableOpacity style={S.loginGateBtn} onPress={() => router.push('/(auth)/login')}>
                  <Text style={S.loginGateBtnText}>Iniciar sesión</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                  <Text style={S.loginGateLink}>Crear cuenta gratis</Text>
                </TouchableOpacity>
              </View>
            )}

            {isAuthenticated && (<>
            {/* Specs */}
            {(property.bedrooms != null || property.bathrooms != null || property.area_m2 != null) && (
              <View style={S.specs}>
                {property.bedrooms != null && (
                  <View style={S.specBox}>
                    <Ionicons name="bed-outline" size={22} color={Colors.primary} />
                    <Text style={S.specVal}>{property.bedrooms}</Text>
                    <Text style={S.specLbl}>Dormitorios</Text>
                  </View>
                )}
                {property.bathrooms != null && (
                  <View style={S.specBox}>
                    <Ionicons name="water-outline" size={22} color={Colors.primary} />
                    <Text style={S.specVal}>{property.bathrooms}</Text>
                    <Text style={S.specLbl}>Baños</Text>
                  </View>
                )}
                {property.area_m2 != null && (
                  <View style={S.specBox}>
                    <Ionicons name="resize-outline" size={22} color={Colors.primary} />
                    <Text style={S.specVal}>{property.area_m2}</Text>
                    <Text style={S.specLbl}>m²</Text>
                  </View>
                )}
              </View>
            )}

            {/* Description */}
            {/* Amenities */}
            {property.property_amenities && property.property_amenities.length > 0 && (
              <View style={S.section}>
                <Text style={S.sectionTitle}>Amenidades</Text>
                <View style={S.amenitiesWrap}>
                  {property.property_amenities.map((pa) => (
                    <View key={pa.amenities.id} style={S.amenityBadge}>
                      <Ionicons name={(AMENITY_ICONS[pa.amenities.icon] ?? 'star-outline') as any} size={14} color={Colors.primary} />
                      <Text style={S.amenityBadgeText}>{pa.amenities.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!!property.description && (
              <View style={S.section}>
                <Text style={S.sectionTitle}>Descripción</Text>
                <Text style={S.desc}>{property.description}</Text>
              </View>
            )}

            {/* Location */}
            {property.latitude && property.longitude && (
              <View style={S.section}>
                <Text style={S.sectionTitle}>Ubicación</Text>
                <TouchableOpacity
                  style={S.mapCard}
                  onPress={() => Linking.openURL(`https://www.google.com/maps?q=${property.latitude},${property.longitude}`)}
                >
                  <Ionicons name="map-outline" size={20} color={Colors.primary} />
                  <Text style={S.mapText}>Ver en Google Maps</Text>
                  <Ionicons name="open-outline" size={16} color={Colors.gray[400]} />
                </TouchableOpacity>
              </View>
            )}
            </>)}

            {/* Publicidad de empresas */}
            <AdSlot />
          </View>

          {/* Sidebar */}
          <View style={S.sidebar}>
            {/* Price card */}
            <View style={S.priceCard}>
              <Text style={S.priceCardLabel}>Precio</Text>
              <Text style={S.priceCardValue}>{formatPrice(property.price, property.currency)}</Text>
              {property.operation === 'rent' && <Text style={S.priceCardSub}>por mes</Text>}
            </View>

            {/* Owner card (solo con sesión) */}
            {isAuthenticated && property.users && (
              <View style={S.ownerCard}>
                <Text style={S.ownerCardTitle}>Propietario</Text>
                <View style={S.ownerRow}>
                  <View style={S.ownerAvatar}>
                    <Text style={S.ownerInitial}>{property.users.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.ownerName}>{property.users.name}</Text>
                    <Text style={S.ownerSub}>Vendedor directo</Text>
                  </View>
                </View>
                {phone && (
                  <>
                    <TouchableOpacity style={S.waBtn} onPress={openWhatsApp}>
                      <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                      <Text style={S.waBtnText}>Contactar por WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={S.callBtn} onPress={() => Linking.openURL(`tel:${phone}`)}>
                      <Ionicons name="call-outline" size={18} color={Colors.primary} />
                      <Text style={S.callBtnText}>Llamar</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  loginGate: {
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.xxl,
    marginTop: Spacing.xl,
  },
  loginGateTitle: { fontSize: Fonts.sizes.lg, fontWeight: '800', color: Colors.gray[900], marginTop: Spacing.md },
  loginGateText: { fontSize: Fonts.sizes.sm, color: Colors.gray[600], textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
  loginGateBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xxl,
    borderRadius: Radius.lg,
    marginTop: Spacing.lg,
    cursor: 'pointer' as any,
  },
  loginGateBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.md },
  loginGateLink: { color: Colors.primary, fontWeight: '600', fontSize: Fonts.sizes.sm, marginTop: Spacing.md, cursor: 'pointer' as any },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  errorText: { fontSize: Fonts.sizes.md, color: Colors.gray[500] },
  backLink: { color: Colors.primary, fontWeight: '600', fontSize: Fonts.sizes.md },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
    backgroundColor: Colors.white,
  },
  topRight: { flexDirection: 'row', gap: Spacing.sm },
  topBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, borderColor: Colors.gray[200],
    justifyContent: 'center', alignItems: 'center',
    cursor: 'pointer' as any,
  },

  // Gallery
  gallery: { backgroundColor: '#000' },
  hero: { position: 'relative', cursor: 'pointer' as any },
  heroImg: { width: '100%', height: 480 },
  noImage: {
    backgroundColor: Colors.gray[100],
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  noImageText: { fontSize: Fonts.sizes.sm, color: Colors.gray[400] },
  heroOverlay: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  expandHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  expandText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  heroCounter: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  heroCounterText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  thumbRow: {
    flexDirection: 'row', gap: 3, padding: 3,
    backgroundColor: '#111',
  },
  thumb: {
    flex: 1, maxWidth: 120, height: 72,
    borderRadius: 4, overflow: 'hidden',
    opacity: 0.6, cursor: 'pointer' as any, position: 'relative',
  },
  thumbActive: { opacity: 1 },
  thumbImg: { width: '100%', height: '100%' },
  thumbActiveLine: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 3, backgroundColor: Colors.primary,
  },

  // Content layout
  content: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 32,
    maxWidth: 1100, alignSelf: 'center', width: '100%',
    paddingHorizontal: 32, paddingVertical: 32,
  },
  main: { flex: 1 },
  sidebar: { width: 320, gap: 16 },

  tags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  opTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.sm },
  opTagText: { color: '#fff', fontSize: Fonts.sizes.xs, fontWeight: '700' },
  typeTag: { backgroundColor: Colors.gray[100], paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.sm },
  typeTagText: { color: Colors.gray[600], fontSize: Fonts.sizes.xs, fontWeight: '600' },
  viewsTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.gray[50], paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  viewsText: { fontSize: Fonts.sizes.xs, color: Colors.gray[500] },

  title: { fontSize: 26, fontWeight: '800', color: Colors.gray[900], marginBottom: 8, letterSpacing: -0.5 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  addr: { fontSize: Fonts.sizes.sm, color: Colors.gray[500], flex: 1 },
  price: { fontSize: 30, fontWeight: '800', color: Colors.primary, marginBottom: 24 },
  perMonth: { fontSize: Fonts.sizes.md, fontWeight: '400', color: Colors.gray[500] },

  specs: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  specBox: {
    flex: 1, alignItems: 'center', paddingVertical: 16,
    borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md, gap: 4,
  },
  specVal: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  specLbl: { fontSize: Fonts.sizes.xs, color: Colors.gray[500] },

  section: { marginBottom: 28 },
  sectionTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900], marginBottom: 10 },
  desc: { fontSize: Fonts.sizes.md, color: Colors.gray[600], lineHeight: 26 },
  amenitiesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  amenityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: Radius.full, backgroundColor: Colors.primaryLight },
  amenityBadgeText: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: '500' },

  mapCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, backgroundColor: Colors.gray[50],
    borderRadius: Radius.lg, gap: 10, cursor: 'pointer' as any,
  },
  mapText: { flex: 1, fontSize: Fonts.sizes.md, color: Colors.primary, fontWeight: '600' },

  // Sidebar
  priceCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg, padding: 20,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  priceCardLabel: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: '600', marginBottom: 4 },
  priceCardValue: { fontSize: 28, fontWeight: '800', color: Colors.primary },
  priceCardSub: { fontSize: 13, color: Colors.primary, opacity: 0.7, marginTop: 2 },

  ownerCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 20,
    borderWidth: 1, borderColor: Colors.gray[200], gap: 12,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)' as any,
  },
  ownerCardTitle: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.gray[500] },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownerAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  ownerInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  ownerName: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.gray[900] },
  ownerSub: { fontSize: 12, color: Colors.gray[400], marginTop: 2 },
  waBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#25D366', paddingVertical: 14,
    borderRadius: Radius.lg, cursor: 'pointer' as any,
  },
  waBtnText: { color: '#fff', fontWeight: '700', fontSize: Fonts.sizes.md },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12,
    borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.gray[200],
    cursor: 'pointer' as any,
  },
  callBtnText: { color: Colors.primary, fontWeight: '700', fontSize: Fonts.sizes.md },
});
