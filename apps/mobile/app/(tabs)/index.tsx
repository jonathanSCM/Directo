import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Circle, Marker, Region } from 'react-native-maps';
import FilterModal, {
  FilterValues,
} from '../../src/components/FilterModal';
import { Logo } from '../../src/components/Logo';
import api from '../../src/services/api';
import { Colors, Fonts, Radius, Spacing } from '../../src/constants/theme';

const DEFAULT_RADIUS_KM = 5;

interface PropertyImage {
  id: string;
  url: string;
  is_main: boolean;
}

interface Property {
  id: string;
  title: string;
  slug: string;
  address: string;
  price: number;
  currency: string;
  operation: string;
  latitude: number | null;
  longitude: number | null;
  property_images: PropertyImage[];
  property_types?: { name: string; slug: string };
  zones?: { name: string; city: string };
  users?: { name: string; phone?: string };
  whatsapp?: string;
  bedrooms?: number;
  bathrooms?: number;
  area_m2?: number;
}

const FILTERS = ['Todos', 'Venta', 'Alquiler', 'Anticrético'];
const FILTER_MAP: Record<string, string | undefined> = {
  Todos: undefined,
  Venta: 'sale',
  Alquiler: 'rent',
  Anticrético: 'anticretico',
};

const markerImages = {
  sale: require('../../assets/markers/marker-sale.png'),
  rent: require('../../assets/markers/marker-rent.png'),
  anticretico: require('../../assets/markers/marker-anti.png'),
  active: require('../../assets/markers/marker-active.png'),
};

const getMarkerImage = (operation: string, isSelected: boolean) => {
  if (isSelected) return markerImages.active;
  if (operation === 'sale') return markerImages.sale;
  if (operation === 'rent') return markerImages.rent;
  return markerImages.anticretico;
};

// Marcador con imagen-hijo dimensionada en dp (Android ignora el tamaño en la
// prop `image`, por eso se veían enormes). tracksViewChanges debe ser true al
// montar para que Android dibuje el marcador custom; luego se apaga por rendimiento.
function PropertyMarker({
  prop,
  selected,
  onPress,
}: {
  prop: Property;
  selected: boolean;
  onPress: () => void;
}) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t);
  }, [selected]);

  const w = selected ? 30 : 26;
  const h = selected ? 39 : 34;

  return (
    <Marker
      identifier={prop.id}
      coordinate={{ latitude: prop.latitude!, longitude: prop.longitude! }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracks}
    >
      <Image
        source={getMarkerImage(prop.operation, selected)}
        style={{ width: w, height: h }}
        resizeMode="contain"
      />
    </Marker>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({});
  const [region, setRegion] = useState<Region>({
    latitude: -17.7833,
    longitude: -63.1821,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [searchCenter, setSearchCenter] = useState<{ latitude: number; longitude: number } | null>(null);

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Zone search suggestions
  const [zoneSuggestions, setZoneSuggestions] = useState<{ id: string; name: string; city: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Oculta los controles flotantes mientras el teclado está abierto
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(coords);
        setSearchCenter(coords);
        setRegion((prev) => ({ ...prev, ...coords }));
        mapRef.current?.animateToRegion(
          { ...coords, latitudeDelta: 0.04, longitudeDelta: 0.04 },
          600,
        );
      }
    })();
  }, []);

  const fetchProperties = useCallback(
    async (center?: { latitude: number; longitude: number }) => {
      try {
        const c = center ?? searchCenter ?? { latitude: region.latitude, longitude: region.longitude };
        const params: Record<string, any> = { limit: 100 };
        const op = filters.operation ?? FILTER_MAP[activeFilter];
        if (op) params.operation = op;
        const hasTextSearch = !!search.trim();
        if (hasTextSearch) params.q = search.trim();
        if (filters.propertyType) params.type = filters.propertyType;
        if (filters.minPrice) params.min_price = filters.minPrice;
        if (filters.maxPrice) params.max_price = filters.maxPrice;
        if (filters.bedrooms) params.bedrooms = filters.bedrooms;

        // Con búsqueda de texto no limitamos por radio: si no, un resultado
        // fuera del área visible del mapa no aparece nunca y parece que la
        // búsqueda "no funciona". Sin texto, sí filtramos por cercanía.
        if (!hasTextSearch) {
          params.lat = c.latitude;
          params.lng = c.longitude;
          params.radius_km = radiusKm;
        }

        const { data } = await api.get('/properties', { params });
        const parsed = (data.data ?? []).map((p: any) => ({
          ...p,
          latitude: p.latitude ? Number(p.latitude) : null,
          longitude: p.longitude ? Number(p.longitude) : null,
          price: Number(p.price),
        }));
        setProperties(parsed);
        return parsed as Property[];
      } catch {
        // offline
        return [];
      }
    },
    [activeFilter, search, filters, region, searchCenter, radiusKm],
  );

  // Fetch on filter/search change
  useEffect(() => {
    fetchProperties();
  }, [activeFilter, filters, searchCenter, radiusKm]);

  // Reload properties when screen gains focus (e.g. after creating/editing)
  useFocusEffect(
    useCallback(() => {
      fetchProperties();
    }, [fetchProperties]),
  );

  // Search with debounce
  const onSearchSubmit = useCallback(async () => {
    setShowSuggestions(false);
    const results = await fetchProperties();
    // La búsqueda de texto no está limitada al área visible: si los
    // resultados quedan fuera, hay que mover el mapa para que se vean.
    if (search.trim()) {
      const geo = results.filter((p) => p.latitude != null && p.longitude != null);
      if (geo.length > 0) {
        mapRef.current?.fitToCoordinates(
          geo.map((p) => ({ latitude: p.latitude!, longitude: p.longitude! })),
          { edgePadding: { top: 100, right: 60, bottom: 300, left: 60 }, animated: true },
        );
      }
    }
  }, [fetchProperties, search]);

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
        } catch {
          setShowSuggestions(false);
        }
      }, 400);
    } else {
      setZoneSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectZoneSuggestion = async (zone: { id: string; name: string; city: string }) => {
    setSearch(zone.name);
    setShowSuggestions(false);
    // Geocode the zone to center the map
    try {
      const results = await Location.geocodeAsync(`${zone.name}, ${zone.city}, Bolivia`);
      if (results.length > 0) {
        const coords = { latitude: results[0].latitude, longitude: results[0].longitude };
        setSearchCenter(coords);
        mapRef.current?.animateToRegion(
          { ...coords, latitudeDelta: 0.04, longitudeDelta: 0.04 },
          600,
        );
      }
    } catch {}
    fetchProperties();
  };

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const geoProps = properties.filter((p) => p.latitude && p.longitude);

  const onMarkerPress = (prop: Property) => {
    setSelectedId(prop.id);
    router.push(`/property/${prop.slug}`);
  };

  const goToMyLocation = () => {
    if (!userLocation) return;
    setSearchCenter(userLocation);
    mapRef.current?.animateToRegion(
      { ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      500,
    );
  };

  const center = searchCenter ?? { latitude: region.latitude, longitude: region.longitude };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        onRegionChangeComplete={(r) => setRegion(r)}
        showsUserLocation
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        customMapStyle={mapStyle}
      >
        {/* Radius circle */}
        <Circle
          center={center}
          radius={radiusKm * 1000}
          strokeColor="rgba(37, 99, 235, 0.3)"
          fillColor="rgba(37, 99, 235, 0.05)"
          strokeWidth={1.5}
        />
        {geoProps.map((p) => (
          <PropertyMarker
            key={p.id}
            prop={p}
            selected={selectedId === p.id}
            onPress={() => onMarkerPress(p)}
          />
        ))}
      </MapView>

      {/* Search bar */}
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

      {/* Zone suggestions dropdown */}
      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {zoneSuggestions.map((z) => (
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
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, activeFilter === f && styles.chipActive]}
            onPress={() => setActiveFilter(f)}
          >
            <Text
              style={[
                styles.chipText,
                activeFilter === f && styles.chipTextActive,
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.countPill}>
          <Text style={styles.countText}>{geoProps.length}</Text>
        </View>
      </View>

      {/* My location button */}
      {userLocation && !keyboardVisible && (
        <TouchableOpacity style={styles.myLocBtn} onPress={goToMyLocation}>
          <Ionicons name="navigate" size={20} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* Radius control */}
      {!keyboardVisible && <View style={styles.radiusControl}>
        <TouchableOpacity
          style={styles.radiusBtn}
          onPress={() => setRadiusKm(Math.max(1, radiusKm - 2))}
        >
          <Ionicons name="remove" size={16} color={Colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.radiusText}>{radiusKm} km</Text>
        <TouchableOpacity
          style={styles.radiusBtn}
          onPress={() => setRadiusKm(Math.min(50, radiusKm + 2))}
        >
          <Ionicons name="add" size={16} color={Colors.gray[700]} />
        </TouchableOpacity>
      </View>}

      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        initial={filters}
        resultCount={geoProps.length}
        onApply={(f) => {
          setFilters(f);
          if (f.operation) {
            const label = Object.entries(FILTER_MAP).find(
              ([, v]) => v === f.operation,
            );
            if (label) setActiveFilter(label[0]);
          }
        }}
      />
    </View>
  );
}

// Plomo/gris claro, igual look que las teselas CartoDB "light_all" de la versión web.
const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f2f2f2' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#707070' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f2f2f2' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#d6d6d6' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e8e5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dde3e8' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    position: 'absolute',
    top: 56,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: Fonts.sizes.md,
    color: Colors.gray[900],
  },
  searchDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.gray[200],
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 20,
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
  suggestionText: {
    fontSize: Fonts.sizes.sm,
    color: Colors.gray[700],
  },
  filterRow: {
    position: 'absolute',
    top: 116,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  chipTextActive: { color: Colors.white },
  countPill: {
    backgroundColor: Colors.gray[800],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  countText: {
    color: Colors.white,
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
  },
  myLocBtn: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  radiusControl: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 156,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    paddingHorizontal: 4,
    paddingVertical: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    gap: 2,
  },
  radiusBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  radiusText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
    color: Colors.gray[700],
    minWidth: 36,
    textAlign: 'center',
  },
});
