import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
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
import { getImageUrl } from '../../src/constants/api';
import api from '../../src/services/api';
import { Colors, Fonts, Radius, Spacing } from '../../src/constants/theme';
import OwnerSupportFAB from '../../src/components/support/OwnerSupportChat';

const { width } = Dimensions.get('window');

interface PropertyImage {
  id: string;
  url: string;
  is_main: boolean;
}

interface PropertyDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  address: string;
  price: number;
  currency: string;
  operation: string;
  bedrooms?: number;
  bathrooms?: number;
  area_m2?: number;
  latitude?: number;
  longitude?: number;
  whatsapp?: string;
  views_count?: number;
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

const opLabel = (op: string) => {
  if (op === 'sale') return 'Venta';
  if (op === 'rent') return 'Alquiler';
  return 'Anticrético';
};

const opColor = (op: string) => {
  if (op === 'sale') return '#F59E0B';
  if (op === 'rent') return '#EF4444';
  return '#22C55E';
};

const formatPrice = (p: number, c: string) => {
  if (c === 'USD') return `$${p.toLocaleString()}`;
  return `Bs. ${p.toLocaleString()}`;
};

export default function PropertyDetailScreen() {
  const { id: slug } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const isOwner = user?.active_role === 'owner';
  const { isFavorite, toggleFavorite } = useFavorites();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const viewKey = `viewed_${slug}`;
        const alreadyViewed = await AsyncStorage.getItem(viewKey);
        const trackView = !alreadyViewed;

        const { data } = await api.get(`/properties/${slug}`, {
          params: trackView ? { track_view: 'true' } : {},
        });
        setProperty({
          ...data,
          latitude: data.latitude ? Number(data.latitude) : null,
          longitude: data.longitude ? Number(data.longitude) : null,
          price: Number(data.price),
          views_count: Number(data.views_count ?? 0),
        });

        if (trackView) {
          await AsyncStorage.setItem(viewKey, '1');
        }
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.gray[300]} />
        <Text style={styles.errorText}>Propiedad no encontrada</Text>
        <TouchableOpacity
          style={styles.backLink}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.backLinkText}>Volver al mapa</Text>
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

  const onShare = async () => {
    await Share.share({
      message: `${property.title} - ${formatPrice(property.price, property.currency)}\nVe esta propiedad en DIRECTO`,
    });
  };

  const openWhatsApp = () => {
    if (!phone) return;
    Linking.openURL(
      `https://wa.me/${phone.replace(/\D/g, '')}?text=Hola, me interesa "${property.title}" en DIRECTO. ¿Está disponible?`,
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Image gallery */}
        <View>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setImgIndex(idx);
            }}
            renderItem={({ item }) => (
              <Image source={{ uri: getImageUrl(item.url)! }} style={styles.image} />
            )}
            ListEmptyComponent={
              <View style={[styles.image, styles.noImage]}>
                <Ionicons
                  name="image-outline"
                  size={48}
                  color={Colors.gray[300]}
                />
              </View>
            }
          />
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.topBtn}
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace('/(tabs)')
              }
            >
              <Ionicons name="chevron-back" size={22} color={Colors.white} />
            </TouchableOpacity>
            <View style={styles.topRight}>
              <TouchableOpacity style={styles.topBtn} onPress={onShare}>
                <Ionicons
                  name="share-outline"
                  size={20}
                  color={Colors.white}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.topBtn}
                onPress={() => toggleFavorite(property.id)}
              >
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={20}
                  color={liked ? '#EF4444' : Colors.white}
                />
              </TouchableOpacity>
            </View>
          </View>
          {images.length > 1 && (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {imgIndex + 1}/{images.length}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          {/* Tags */}
          <View style={styles.tags}>
            <View
              style={[
                styles.opTag,
                { backgroundColor: opColor(property.operation) },
              ]}
            >
              <Text style={styles.opTagText}>
                {opLabel(property.operation)}
              </Text>
            </View>
            {property.property_types && (
              <View style={styles.typeTag}>
                <Text style={styles.typeTagText}>
                  {property.property_types.name}
                </Text>
              </View>
            )}
            {property.views_count != null && property.views_count > 0 && (
              <View style={styles.viewsTag}>
                <Ionicons
                  name="eye-outline"
                  size={12}
                  color={Colors.gray[500]}
                />
                <Text style={styles.viewsTagText}>
                  {property.views_count} visitas
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.title}>{property.title}</Text>

          <View style={styles.addressRow}>
            <Ionicons
              name="location-outline"
              size={16}
              color={Colors.gray[500]}
            />
            <Text style={styles.address}>{location}</Text>
          </View>

          <Text style={styles.price}>
            {formatPrice(property.price, property.currency)}
            {property.operation === 'rent' && (
              <Text style={styles.perMonth}> /mes</Text>
            )}
          </Text>

          {/* Sin sesión: el resto del detalle queda bloqueado */}
          {!isAuthenticated && (
            <View style={styles.loginGate}>
              <Ionicons name="lock-closed" size={40} color={Colors.primary} />
              <Text style={styles.loginGateTitle}>Inicia sesión para ver todo</Text>
              <Text style={styles.loginGateText}>
                Detalles completos, fotos, amenidades y contacto directo con el propietario.
              </Text>
              <TouchableOpacity
                style={styles.loginGateBtn}
                onPress={() => router.push('/(auth)/login')}
              >
                <Text style={styles.loginGateBtnText}>Iniciar sesión</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={styles.loginGateLink}>Crear cuenta gratis</Text>
              </TouchableOpacity>
            </View>
          )}

          {isAuthenticated && (<>
          {/* Specs */}
          <View style={styles.specs}>
            {property.bedrooms != null && (
              <View style={styles.specBox}>
                <Ionicons
                  name="bed-outline"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.specValue}>{property.bedrooms}</Text>
                <Text style={styles.specLabel}>Dormitorios</Text>
              </View>
            )}
            {property.bathrooms != null && (
              <View style={styles.specBox}>
                <Ionicons
                  name="water-outline"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.specValue}>{property.bathrooms}</Text>
                <Text style={styles.specLabel}>Baños</Text>
              </View>
            )}
            {property.area_m2 != null && (
              <View style={styles.specBox}>
                <Ionicons
                  name="resize-outline"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.specValue}>{property.area_m2}</Text>
                <Text style={styles.specLabel}>m²</Text>
              </View>
            )}
          </View>

          {/* Amenities */}
          {property.property_amenities && property.property_amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenidades</Text>
              <View style={styles.amenitiesWrap}>
                {property.property_amenities.map((pa) => (
                  <View key={pa.amenities.id} style={styles.amenityBadge}>
                    <Ionicons name={(AMENITY_ICONS[pa.amenities.icon] ?? 'star-outline') as any} size={14} color={Colors.primary} />
                    <Text style={styles.amenityBadgeText}>{pa.amenities.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          {property.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Descripción</Text>
              <Text style={styles.description}>{property.description}</Text>
            </View>
          ) : null}

          {/* Owner */}
          {property.users && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Propietario</Text>
              <View style={styles.ownerCard}>
                <View style={styles.ownerAvatar}>
                  <Text style={styles.ownerInitial}>
                    {property.users.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.ownerInfo}>
                  <Text style={styles.ownerName}>{property.users.name}</Text>
                  <Text style={styles.ownerHint}>Contactar por WhatsApp</Text>
                </View>
                {phone && (
                  <TouchableOpacity
                    style={styles.ownerWaBtn}
                    onPress={openWhatsApp}
                  >
                    <Ionicons
                      name="logo-whatsapp"
                      size={20}
                      color={Colors.white}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Location */}
          {property.latitude && property.longitude && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ubicación</Text>
              <TouchableOpacity
                style={styles.locationCard}
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps?q=${property.latitude},${property.longitude}`,
                  )
                }
              >
                <Ionicons
                  name="map-outline"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.locationText}>Ver en Google Maps</Text>
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={Colors.gray[400]}
                />
              </TouchableOpacity>
            </View>
          )}
          </>)}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      {isAuthenticated && phone && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${phone}`)}
          >
            <Ionicons name="call-outline" size={20} color={Colors.primary} />
            <Text style={styles.callBtnText}>Llamar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.whatsappBtn} onPress={openWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color={Colors.white} />
            <Text style={styles.whatsappBtnText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      )}
      {isOwner && <OwnerSupportFAB />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
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
  },
  loginGateBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.md },
  loginGateLink: { color: Colors.primary, fontWeight: '600', fontSize: Fonts.sizes.sm, marginTop: Spacing.md },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  errorText: { fontSize: Fonts.sizes.md, color: Colors.gray[500] },
  backLink: { marginTop: Spacing.md },
  backLinkText: { color: Colors.primary, fontWeight: '600' },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topRight: { flexDirection: 'row', gap: Spacing.sm },
  topBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width, height: 300 },
  noImage: {
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  counterText: {
    color: Colors.white,
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
  },
  body: { padding: Spacing.xxl },
  tags: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  opTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  opTagText: {
    color: Colors.white,
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
  },
  typeTag: {
    backgroundColor: Colors.gray[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  typeTagText: {
    color: Colors.gray[600],
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
  },
  viewsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.gray[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  viewsTagText: { fontSize: Fonts.sizes.xs, color: Colors.gray[500] },
  title: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: Spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.md,
  },
  address: { fontSize: Fonts.sizes.sm, color: Colors.gray[500], flex: 1 },
  price: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: Spacing.xxl,
  },
  perMonth: {
    fontSize: Fonts.sizes.md,
    fontWeight: '400',
    color: Colors.gray[500],
  },
  specs: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  specBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    gap: 2,
  },
  specValue: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  specLabel: { fontSize: Fonts.sizes.xs, color: Colors.gray[500] },
  section: { marginBottom: Spacing.xxl },
  sectionTitle: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: Fonts.sizes.md,
    color: Colors.gray[600],
    lineHeight: 22,
  },
  amenitiesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  amenityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: Radius.full, backgroundColor: Colors.primaryLight,
  },
  amenityBadgeText: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: '500' },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.gray[50],
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerInitial: {
    color: Colors.white,
    fontSize: Fonts.sizes.lg,
    fontWeight: '700',
  },
  ownerInfo: { flex: 1 },
  ownerName: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  ownerHint: {
    fontSize: Fonts.sizes.xs,
    color: Colors.gray[400],
    marginTop: 2,
  },
  ownerWaBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.gray[50],
    borderRadius: Radius.lg,
    gap: Spacing.sm,
  },
  locationText: {
    flex: 1,
    fontSize: Fonts.sizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  bottomBar: {
    flexDirection: 'row',
    padding: Spacing.lg,
    paddingBottom: 34,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[200],
    backgroundColor: Colors.white,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  callBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: Fonts.sizes.md,
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: '#25D366',
  },
  whatsappBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: Fonts.sizes.md,
  },
});
