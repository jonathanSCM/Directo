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
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import FilterModal, { FilterValues } from '../../src/components/FilterModal';
import { Logo } from '../../src/components/Logo';
import { getImageUrl } from '../../src/constants/api';
import { useFavorites } from '../../src/context/FavoritesContext';
import api from '../../src/services/api';
import { Colors, Fonts, Radius, Spacing } from '../../src/constants/theme';

// Inject Leaflet CSS + our own overrides (strip default tooltip chrome so our
// custom preview card renders without Leaflet's bubble/arrow styling) once
function useLeafletCSS() {
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('directo-map-css')) {
      const style = document.createElement('style');
      style.id = 'directo-map-css';
      style.textContent = `
        .leaflet-tooltip.directo-tooltip {
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          border-radius: 0;
          opacity: 1;
        }
        .leaflet-tooltip.directo-tooltip::before { display: none; }
        /* La preview fija del marcador seleccionado debe recibir clics */
        .leaflet-tooltip.directo-tooltip.directo-tooltip-open {
          pointer-events: auto;
          cursor: pointer;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
}

const { width } = Dimensions.get('window');
const PANEL_WIDTH = Math.min(width, 420);
// Escritorio: preview al primer clic + panel que no bloquea el mapa.
// Móvil web: comportamiento directo (clic = abrir detalle) como hasta ahora.
const isDesktop = width >= 768;
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

// Compact preview shown above a marker. En hover es informativa; cuando el
// marcador está seleccionado queda fija y clickeable para abrir el detalle.
function MarkerPreview({ prop, onOpen }: { prop: Property; onOpen?: () => void }) {
  const imgUrl = getMainImage(prop.property_images);
  const body = (
    <View style={[previewStyles.card, !!onOpen && previewStyles.cardClickable]}>
      <View style={previewStyles.imgWrap}>
        {imgUrl ? (
          <Image source={{ uri: imgUrl }} style={previewStyles.img} />
        ) : (
          <View style={[previewStyles.img, previewStyles.noImg]}>
            <Ionicons name="image-outline" size={18} color={Colors.gray[300]} />
          </View>
        )}
      </View>
      <View style={previewStyles.info}>
        <View style={[previewStyles.badge, { backgroundColor: opColor(prop.operation) }]}>
          <Text style={previewStyles.badgeText}>{opLabel(prop.operation)}</Text>
        </View>
        <Text style={previewStyles.title} numberOfLines={1}>{prop.title}</Text>
        <Text style={previewStyles.address} numberOfLines={1}>
          {prop.zones ? `${prop.zones.name}, ${prop.zones.city}` : prop.address}
        </Text>
        <Text style={previewStyles.price}>{formatPrice(prop.price, prop.currency)}</Text>
        {!!onOpen && <Text style={previewStyles.openHint}>Toca para ver detalles →</Text>}
      </View>
    </View>
  );
  if (!onOpen) return body;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onOpen}>
      {body}
    </TouchableOpacity>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  useLeafletCSS();

  const mapRef = useRef<L.Map | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelAnim = useRef(new Animated.Value(0)).current;

  const [properties, setProperties] = useState<Property[]>([]);
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailProp, setDetailProp] = useState<Property | null>(null);
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

  useEffect(() => {
    Animated.timing(panelAnim, {
      toValue: detailProp ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [detailProp]);

  const geoProps = properties.filter(p => p.latitude && p.longitude);

  const onMarkerPress = (prop: Property) => {
    setFlyTarget({ coord: [prop.latitude!, prop.longitude!], zoom: 16 });

    if (!isDesktop) {
      // Móvil web: clic abre el detalle directo (como siempre)
      setSelectedId(prop.id);
      setDetailProp(prop);
      return;
    }

    if (detailProp) {
      // Panel abierto: seleccionar otro marcador cambia el detalle al vuelo
      setSelectedId(prop.id);
      setDetailProp(prop);
      return;
    }

    if (selectedId === prop.id) {
      // Segundo clic en el mismo marcador también abre el detalle
      setDetailProp(prop);
      return;
    }

    // Primer clic: solo fija la preview sobre el marcador
    setSelectedId(prop.id);
  };

  const goToMyLocation = () => {
    if (!userLocation) return;
    setSearchCenter(userLocation);
    setFlyTarget({ coord: [userLocation.latitude, userLocation.longitude], zoom: 15 });
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
            url="https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png"
          />
          <Circle
            center={[center.latitude, center.longitude]}
            radius={radiusKm * 1000}
            pathOptions={{ color: 'rgba(37,99,235,0.3)', fillColor: 'rgba(37,99,235,0.05)', weight: 1.5 }}
          />
          {geoProps.map(p => {
            const isSelected = selectedId === p.id;
            // En escritorio la preview del seleccionado queda fija (permanent)
            // y clickeable; en el resto solo aparece al hover.
            const sticky = isDesktop && isSelected;
            return (
              <Marker
                key={p.id}
                position={[p.latitude!, p.longitude!]}
                icon={makeMarkerIcon(p.operation, isSelected)}
                eventHandlers={{ click: () => onMarkerPress(p) }}
              >
                <Tooltip
                  // permanent no cambia en caliente: remount al alternar
                  key={`${p.id}-${sticky ? 'stick' : 'hover'}`}
                  direction="top"
                  offset={[0, sticky ? -50 : -44]}
                  opacity={1}
                  permanent={sticky}
                  interactive={sticky}
                  className={`directo-tooltip${sticky ? ' directo-tooltip-open' : ''}`}
                >
                  <MarkerPreview
                    prop={p}
                    onOpen={sticky ? () => { setDetailProp(p); } : undefined}
                  />
                </Tooltip>
              </Marker>
            );
          })}
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

      {/* Left side detail panel — tarjeta flotante centrada verticalmente,
          en vez de una barra que se estira toda la altura y deja espacio
          vacío abajo cuando el contenido es corto. Ancho caps at 420 so on
          narrow (mobile web) viewports it naturally becomes a full-width
          overlay instead.
          En escritorio NO bloquea el mapa: se puede seguir explorando y
          seleccionar otra propiedad reemplaza el contenido del panel. */}
      <View style={styles.detailPanelWrap} pointerEvents={detailProp ? 'box-none' : 'none'}>
        <Animated.View
          style={[
            styles.detailPanel,
            {
              width: PANEL_WIDTH,
              transform: [{
                translateX: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [-PANEL_WIDTH - Spacing.xl, 0] }),
              }],
            },
          ]}
        >
          {detailProp && (() => {
            const mainImg = getMainImage(detailProp.property_images);
            const liked = isFavorite(detailProp.id);
            return (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailImageWrap}>
                  {mainImg ? (
                    <Image source={{ uri: mainImg }} style={styles.detailImage} />
                  ) : (
                    <View style={[styles.detailImage, styles.noImage]}>
                      <Ionicons name="image-outline" size={40} color={Colors.gray[300]} />
                      <Text style={styles.noImageText}>Sin fotos todavía</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setDetailProp(null)}>
                    <Ionicons name="close" size={22} color={Colors.white} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.detailHeartBtn} onPress={() => toggleFavorite(detailProp.id)}>
                    <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#EF4444' : Colors.white} />
                  </TouchableOpacity>
                  <View style={[styles.opTag, styles.opTagFloating, { backgroundColor: opColor(detailProp.operation) }]}>
                    <Text style={styles.opTagText}>{opLabel(detailProp.operation)}</Text>
                  </View>
                </View>
                <View style={styles.detailBody}>
                  <Text style={styles.detailPrice}>{formatPrice(detailProp.price, detailProp.currency)}</Text>
                  <Text style={styles.detailTitle}>{detailProp.title}</Text>
                  <View style={styles.detailAddressRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.gray[400]} />
                    <Text style={styles.detailAddress}>
                      {detailProp.zones ? `${detailProp.zones.name}, ${detailProp.zones.city}` : detailProp.address}
                    </Text>
                  </View>
                  {(detailProp.bedrooms != null || detailProp.bathrooms != null || detailProp.area_m2 != null) && (
                    <View style={styles.detailSpecsRow}>
                      {detailProp.bedrooms != null && (
                        <View style={styles.detailSpecItem}>
                          <Ionicons name="bed-outline" size={16} color={Colors.gray[600]} />
                          <Text style={styles.detailSpecText}>{detailProp.bedrooms} hab.</Text>
                        </View>
                      )}
                      {detailProp.bathrooms != null && (
                        <View style={styles.detailSpecItem}>
                          <Ionicons name="water-outline" size={16} color={Colors.gray[600]} />
                          <Text style={styles.detailSpecText}>{detailProp.bathrooms} baños</Text>
                        </View>
                      )}
                      {detailProp.area_m2 != null && (
                        <View style={styles.detailSpecItem}>
                          <Ionicons name="resize-outline" size={16} color={Colors.gray[600]} />
                          <Text style={styles.detailSpecText}>{detailProp.area_m2} m²</Text>
                        </View>
                      )}
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.detailViewBtn}
                    onPress={() => router.push(`/property/${detailProp.slug}`)}
                  >
                    <Text style={styles.detailViewText}>Ver detalle completo</Text>
                    <Ionicons name="arrow-forward" size={16} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            );
          })()}
        </Animated.View>
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
    bottom: Spacing.xl,
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
    bottom: 78,
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

  noImage: { backgroundColor: Colors.gray[100], justifyContent: 'center', alignItems: 'center', gap: 6 },
  noImageText: { fontSize: Fonts.sizes.xs, color: Colors.gray[400], fontWeight: '500' },
  opTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  opTagText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  opTagFloating: { position: 'absolute', left: Spacing.lg, bottom: Spacing.lg, paddingHorizontal: 10, paddingVertical: 4 },

  // Contenedor invisible que centra verticalmente la tarjeta flotante; el mapa
  // sigue siendo interactuable a los costados (pointerEvents: box-none).
  detailPanelWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    zIndex: 2000,
    justifyContent: 'center',
    paddingLeft: Spacing.xl,
  },
  // Tarjeta flotante (caps at 420px; on narrow/mobile web viewports this
  // equals the screen width, becoming a natural full-width overlay)
  detailPanel: {
    maxHeight: '82%',
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    boxShadow: '0 20px 56px rgba(0,0,0,0.28)' as any,
  },
  detailImageWrap: { width: '100%', height: 240 },
  detailImage: { width: '100%', height: '100%' as any },
  detailCloseBtn: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  detailHeartBtn: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  detailBody: { padding: Spacing.xl },
  detailPrice: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.gray[900], marginBottom: 4 },
  detailTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.gray[900], marginBottom: 6 },
  detailAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.lg },
  detailAddress: { fontSize: Fonts.sizes.sm, color: Colors.gray[500] },
  detailSpecsRow: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.xl },
  detailSpecItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailSpecText: { fontSize: Fonts.sizes.sm, color: Colors.gray[600], fontWeight: '500' },
  detailViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    cursor: 'pointer' as any,
  },
  detailViewText: { color: Colors.white, fontSize: Fonts.sizes.sm, fontWeight: '700' },
});

// Hover preview card shown above a marker
const previewStyles = StyleSheet.create({
  card: {
    width: 220,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)' as any,
  },
  imgWrap: { borderRadius: Radius.sm, overflow: 'hidden' as any },
  img: { width: 56, height: 56 },
  noImg: { backgroundColor: Colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3, marginBottom: 3 },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: '700' },
  title: { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.gray[800] },
  address: { fontSize: 10, color: Colors.gray[400], marginTop: 1 },
  price: { fontSize: Fonts.sizes.sm, fontWeight: '800', color: Colors.gray[900], marginTop: 2 },
  cardClickable: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    cursor: 'pointer' as any,
  },
  openHint: { fontSize: 9, fontWeight: '700', color: Colors.primary, marginTop: 3 },
});
