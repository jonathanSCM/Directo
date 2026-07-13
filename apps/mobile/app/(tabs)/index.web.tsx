/**
 * Web version of the explore screen.
 * Identical layout to the native (full-screen map + floating overlays + card carousel)
 * but uses Leaflet instead of react-native-maps.
 */
import L from 'leaflet';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import FilterModal, { FilterValues } from '../../src/components/FilterModal';
import { Logo } from '../../src/components/Logo';
import { getImageUrl } from '../../src/constants/api';
import { useFavorites } from '../../src/context/FavoritesContext';
import api from '../../src/services/api';
import { Colors, Fonts, Radius, Spacing } from '../../src/constants/theme';

// Inject Leaflet CSS once
function useLeafletCSS() {
  useEffect(() => {
    if (document.getElementById('leaflet-css')) return;
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }, []);
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width * 0.75, 380); // cap at 380 on wide screens
const CARD_MARGIN = 10;
const DEFAULT_RADIUS_KM = 5;
const DEFAULT_CENTER: [number, number] = [-17.7833, -63.1821];

interface PropertyImage { id: string; url: string; is_main: boolean; }
interface Property {
  id: string; title: string; slug: string; address: string;
  price: number; currency: string; operation: string;
  latitude: number | null; longitude: number | null;
  property_images: PropertyImage[];
  property_types?: { name: string; slug: string };
  zones?: { name: string; city: string };
  users?: { name: string; phone?: string };
  whatsapp?: string; bedrooms?: number; bathrooms?: number; area_m2?: number;
}

const FILTERS = ['Todos', 'Venta', 'Alquiler', 'Anticrético'];
const FILTER_MAP: Record<string, string | undefined> = {
  Todos: undefined, Venta: 'sale', Alquiler: 'rent', Anticrético: 'anticretico',
};
const opLabel = (op: string) => op === 'sale' ? 'Venta' : op === 'rent' ? 'Alquiler' : 'Anticrético';
const opColor = (op: string) => op === 'sale' ? '#F59E0B' : op === 'rent' ? '#EF4444' : '#22C55E';
const formatPrice = (p: number, c: string) => c === 'USD' ? `$${p.toLocaleString()}` : `Bs. ${p.toLocaleString()}`;
const getMainImage = (imgs: PropertyImage[]): string | null => {
  if (!imgs?.length) return null;
  const main = imgs.find(i => i.is_main);
  return getImageUrl((main ?? imgs[0]).url);
};

// PNG markers from /public/markers/ — served as static assets on web
const MARKER_URLS: Record<string, string> = {
  sale: '/markers/marker-sale.png',
  rent: '/markers/marker-rent.png',
  anticretico: '/markers/marker-anti.png',
};
const MARKER_ACTIVE_URL = '/markers/marker-active.png';

const makeMarkerIcon = (operation: string, isSelected: boolean) => {
  const url = isSelected ? MARKER_ACTIVE_URL : (MARKER_URLS[operation] ?? MARKER_URLS.sale);
  const w = isSelected ? 36 : 30;
  const h = isSelected ? 48 : 40;
  return L.icon({
    iconUrl: url,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
  });
};

// Fly to coord inside the MapContainer context
function MapFly({ coord, zoom }: { coord: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (coord) map.flyTo(coord, zoom ?? Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [coord]);
  return null;
}

// Store Leaflet map instance in an external ref
function MapGetter({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, []);
  return null;
}

export default function ExploreScreen() {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  useLeafletCSS();

  const flatListRef = useRef<FlatList>(null);
  const mapRef = useRef<L.Map | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({});
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [searchCenter, setSearchCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ coord: [number, number]; zoom?: number } | null>(null);

  // Zone suggestions
  const [zoneSuggestions, setZoneSuggestions] = useState<{ id: string; name: string; city: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get user location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLocation(coords);
          setSearchCenter(coords);
          setFlyTarget({ coord: [coords.latitude, coords.longitude], zoom: 14 });
        }
      } catch { /* browser may deny */ }
    })();
  }, []);

  const center = searchCenter ?? { latitude: DEFAULT_CENTER[0], longitude: DEFAULT_CENTER[1] };

  const fetchProperties = useCallback(async () => {
    try {
      const params: Record<string, any> = { limit: 100 };
      const op = filters.operation ?? FILTER_MAP[activeFilter];
      if (op) params.operation = op;
      if (search.trim()) params.q = search.trim();
      if (filters.propertyType) params.type = filters.propertyType;
      if (filters.minPrice) params.min_price = filters.minPrice;
      if (filters.maxPrice) params.max_price = filters.maxPrice;
      if (filters.bedrooms) params.bedrooms = filters.bedrooms;
      params.lat = center.latitude;
      params.lng = center.longitude;
      params.radius_km = radiusKm;
      const { data } = await api.get('/properties', { params });
      setProperties(
        (data.data ?? []).map((p: any) => ({
          ...p,
          latitude: p.latitude ? Number(p.latitude) : null,
          longitude: p.longitude ? Number(p.longitude) : null,
          price: Number(p.price),
        })),
      );
    } catch { /* offline */ }
  }, [activeFilter, search, filters, center, radiusKm]);

  useEffect(() => { fetchProperties(); }, [activeFilter, filters, radiusKm]);

  useFocusEffect(useCallback(() => { fetchProperties(); }, [fetchProperties]));

  const onSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (text.trim().length >= 2) {
      searchTimerRef.current = setTimeout(async () => {
        try {
          const { data } = await api.get('/zones');
          const filtered = data.filter((z: any) =>
            `${z.name} ${z.city}`.toLowerCase().includes(text.toLowerCase()),
          );
          setZoneSuggestions(filtered.slice(0, 5));
          setShowSuggestions(filtered.length > 0);
        } catch { setShowSuggestions(false); }
      }, 400);
    } else {
      setZoneSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const onSearchSubmit = () => {
    setShowSuggestions(false);
    fetchProperties();
  };

  const selectZoneSuggestion = async (zone: { id: string; name: string; city: string }) => {
    setSearch(zone.name);
    setShowSuggestions(false);
    try {
      // Use Nominatim (free, no API key needed on web)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${zone.name}, ${zone.city}, Bolivia`)}&format=json&limit=1`,
      );
      const results = await res.json();
      if (results.length > 0) {
        const coords = { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) };
        setSearchCenter(coords);
        setFlyTarget({ coord: [coords.latitude, coords.longitude], zoom: 14 });
      }
    } catch {}
    fetchProperties();
  };

  useEffect(() => () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); }, []);

  const geoProps = properties.filter(p => p.latitude && p.longitude);

  const onMarkerPress = (prop: Property) => {
    setSelectedId(prop.id);
    setFlyTarget({ coord: [prop.latitude!, prop.longitude!], zoom: 16 });
    const idx = geoProps.findIndex(p => p.id === prop.id);
    if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true });
  };

  const goToMyLocation = () => {
    if (!userLocation) return;
    setSearchCenter(userLocation);
    setFlyTarget({ coord: [userLocation.latitude, userLocation.longitude], zoom: 15 });
  };

  const openWhatsApp = (prop: Property) => {
    const phone = prop.whatsapp ?? prop.users?.phone;
    if (!phone) return;
    Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}?text=Hola, me interesa "${prop.title}" en DIRECTO`);
  };

  return (
    <View style={styles.container}>
      {/* Full-screen Leaflet map */}
      <View style={StyleSheet.absoluteFillObject}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <Circle
            center={[center.latitude, center.longitude]}
            radius={radiusKm * 1000}
            pathOptions={{ color: 'rgba(37,99,235,0.3)', fillColor: 'rgba(37,99,235,0.05)', weight: 1.5 }}
          />
          {geoProps.map(p => (
            <Marker
              key={p.id}
              position={[p.latitude!, p.longitude!]}
              icon={makeMarkerIcon(p.operation, selectedId === p.id)}
              eventHandlers={{ click: () => onMarkerPress(p) }}
            />
          ))}
          {flyTarget && <MapFly coord={flyTarget.coord} zoom={flyTarget.zoom} />}
          <MapGetter mapRef={mapRef} />
        </MapContainer>
      </View>

      {/* Search bar — same style as native */}
      <View style={styles.searchBar}>
        <Logo size={24} variant="blue" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar zona, dirección..."
          placeholderTextColor={Colors.gray[400]}
          value={search}
          onChangeText={onSearchChange}
          onSubmitEditing={onSearchSubmit}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={onSearchSubmit}>
          <Ionicons name="search" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.searchDivider} />
        <TouchableOpacity onPress={() => setShowFilters(true)}>
          <Ionicons name="options" size={20} color={Colors.gray[600]} />
        </TouchableOpacity>
      </View>

      {/* Zone suggestions */}
      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {zoneSuggestions.map(z => (
            <TouchableOpacity
              key={z.id}
              style={styles.suggestionItem}
              onPress={() => selectZoneSuggestion(z)}
            >
              <Ionicons name="location-outline" size={16} color={Colors.primary} />
              <Text style={styles.suggestionText}>{z.name}, {z.city}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, activeFilter === f && styles.chipActive]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.chipText, activeFilter === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.countPill}>
          <Text style={styles.countText}>{geoProps.length}</Text>
        </View>
      </View>

      {/* My location button */}
      {userLocation && (
        <TouchableOpacity style={styles.myLocBtn} onPress={goToMyLocation}>
          <Ionicons name="navigate" size={20} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* Radius control */}
      <View style={styles.radiusControl}>
        <TouchableOpacity style={styles.radiusBtn} onPress={() => setRadiusKm(r => Math.max(1, r - 2))}>
          <Ionicons name="remove" size={16} color={Colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.radiusText}>{radiusKm} km</Text>
        <TouchableOpacity style={styles.radiusBtn} onPress={() => setRadiusKm(r => Math.min(50, r + 2))}>
          <Ionicons name="add" size={16} color={Colors.gray[700]} />
        </TouchableOpacity>
      </View>

      {/* Bottom panel */}
      <View style={styles.panel}>
        <View style={styles.panelHandle} />
        <View style={styles.panelHeader}>
          <View style={styles.panelLeft}>
            <Text style={styles.panelCount}>
              <Text style={styles.panelCountNum}>{geoProps.length}</Text>
              {' propiedades'}
            </Text>
            {selectedId && (() => {
              const sel = geoProps.find(p => p.id === selectedId);
              return sel ? (
                <TouchableOpacity
                  style={styles.panelViewBtn}
                  onPress={() => router.push(`/property/${sel.slug}`)}
                >
                  <Text style={styles.panelViewText}>Ver propiedad</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                </TouchableOpacity>
              ) : null;
            })()}
          </View>
        </View>
        <FlatList
          ref={flatListRef}
          data={geoProps}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
          decelerationRate="fast"
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: CARD_MARGIN, paddingBottom: 8 }}
          renderItem={({ item }) => {
            const imgUrl = getMainImage(item.property_images);
            const liked = isFavorite(item.id);
            const isSelected = selectedId === item.id;
            return (
              <TouchableOpacity
                style={[styles.card, isSelected && styles.cardSelected]}
                activeOpacity={0.9}
                onPress={() => {
                  setSelectedId(item.id);
                  if (item.latitude && item.longitude) {
                    setFlyTarget({ coord: [item.latitude, item.longitude], zoom: 16 });
                  }
                }}
              >
                <View style={styles.cardImageWrap}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={styles.cardImage} />
                  ) : (
                    <View style={[styles.cardImage, styles.noImage]}>
                      <Ionicons name="image-outline" size={32} color={Colors.gray[300]} />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.heartBtn}
                    onPress={() => toggleFavorite(item.id)}
                  >
                    <Ionicons
                      name={liked ? 'heart' : 'heart-outline'}
                      size={22}
                      color={liked ? '#EF4444' : Colors.white}
                    />
                  </TouchableOpacity>
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="locate" size={12} color="#fff" />
                      <Text style={styles.selectedBadgeText}>Seleccionado</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <View style={[styles.opTag, { backgroundColor: opColor(item.operation) }]}>
                      <Text style={styles.opTagText}>{opLabel(item.operation)}</Text>
                    </View>
                    <Text style={styles.cardPrice}>{formatPrice(item.price, item.currency)}</Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardAddress} numberOfLines={1}>
                    {item.zones ? `${item.zones.name}, ${item.zones.city}` : item.address}
                  </Text>
                  <View style={styles.cardBottom}>
                    <View style={styles.cardSpecs}>
                      {item.bedrooms != null && <Text style={styles.specText}>{item.bedrooms} hab.</Text>}
                      {item.bathrooms != null && <Text style={styles.specText}>{item.bathrooms} baños</Text>}
                      {item.area_m2 != null && <Text style={styles.specText}>{item.area_m2} m²</Text>}
                    </View>
                    {(item.whatsapp || item.users?.phone) && (
                      <TouchableOpacity style={styles.waBtn} onPress={() => openWhatsApp(item)}>
                        <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        initial={filters}
        resultCount={geoProps.length}
        onApply={f => {
          setFilters(f);
          if (f.operation) {
            const label = Object.entries(FILTER_MAP).find(([, v]) => v === f.operation);
            if (label) setActiveFilter(label[0]);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    position: 'absolute',
    top: 16,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    gap: Spacing.sm,
    elevation: 4,
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)' as any,
    zIndex: 1000,
  },
  searchInput: {
    flex: 1,
    fontSize: Fonts.sizes.md,
    color: Colors.gray[900],
    outlineStyle: 'none' as any,
  },
  searchDivider: { width: 1, height: 20, backgroundColor: Colors.gray[200] },
  suggestionsContainer: {
    position: 'absolute',
    top: 72,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    zIndex: 1000,
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)' as any,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  suggestionText: { fontSize: Fonts.sizes.sm, color: Colors.gray[700] },
  filterRow: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
    zIndex: 999,
  },
  chip: {
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)' as any,
    cursor: 'pointer' as any,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[700] },
  chipTextActive: { color: Colors.white },
  countPill: {
    backgroundColor: Colors.gray[800],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  countText: { color: Colors.white, fontSize: Fonts.sizes.xs, fontWeight: '700' },
  myLocBtn: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 270,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)' as any,
    cursor: 'pointer' as any,
  },
  radiusControl: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 322,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    paddingHorizontal: 4,
    paddingVertical: 4,
    zIndex: 999,
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)' as any,
    gap: 2,
  },
  radiusBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  radiusText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
    color: Colors.gray[700],
    minWidth: 36,
    textAlign: 'center',
  },

  // Panel
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingBottom: 12,
  },
  panelHandle: { display: 'none' as any },
  panelHeader: {
    paddingHorizontal: Spacing.lg,
    marginBottom: 6,
  },
  panelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)' as any,
    alignSelf: 'flex-start' as any,
  },
  panelCount: { fontSize: Fonts.sizes.sm, color: Colors.gray[600], fontWeight: '500' },
  panelCountNum: { fontSize: Fonts.sizes.sm, fontWeight: '800', color: Colors.gray[900] },
  panelHint: { fontSize: 11, color: Colors.gray[400] },
  panelViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    cursor: 'pointer' as any,
  },
  panelViewText: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.primary },

  // Card
  card: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
    marginTop: 12,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    boxShadow: '0 2px 10px rgba(0,0,0,0.10)' as any,
    cursor: 'pointer' as any,
  },
  cardSelected: {
    borderColor: Colors.primary,
    boxShadow: '0 0 0 4px rgba(37,99,235,0.15), 0 4px 16px rgba(37,99,235,0.2)' as any,
  },
  cardImageWrap: { borderRadius: Radius.lg - 2, overflow: 'hidden' as any },
  cardImage: { width: '100%', height: 120 },
  noImage: { backgroundColor: Colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  selectedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardBody: { padding: Spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  opTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  opTagText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  cardPrice: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900] },
  cardTitle: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.gray[800] },
  cardAddress: { fontSize: Fonts.sizes.sm, color: Colors.gray[500], marginTop: 2 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  cardSpecs: { flexDirection: 'row', gap: Spacing.md },
  specText: { fontSize: Fonts.sizes.xs, color: Colors.gray[500] },
  waBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
});
