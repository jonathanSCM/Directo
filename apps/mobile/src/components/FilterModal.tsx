import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../constants/theme';

export interface FilterValues {
  operation?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
}

const OPERATIONS = [
  { key: 'sale', label: 'Venta', color: '#F59E0B' },
  { key: 'rent', label: 'Alquiler', color: '#EF4444' },
  { key: 'anticretico', label: 'Anticrético', color: '#22C55E' },
];

const PROPERTY_TYPES = [
  { key: 'casa', label: 'Casa', icon: 'home' },
  { key: 'departamento', label: 'Depto', icon: 'business' },
  { key: 'terreno', label: 'Terreno', icon: 'map' },
  { key: 'oficina', label: 'Oficina', icon: 'briefcase' },
  { key: 'local-comercial', label: 'Local', icon: 'storefront' },
];

const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];

interface Props {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterValues) => void;
  initial?: FilterValues;
  resultCount?: number;
}

export default function FilterModal({
  visible,
  onClose,
  onApply,
  initial,
  resultCount,
}: Props) {
  const [operation, setOperation] = useState(initial?.operation);
  const [propertyType, setPropertyType] = useState(initial?.propertyType);
  const [minPrice, setMinPrice] = useState(initial?.minPrice?.toString() ?? '');
  const [maxPrice, setMaxPrice] = useState(initial?.maxPrice?.toString() ?? '');
  const [bedrooms, setBedrooms] = useState(initial?.bedrooms);

  const handleClear = () => {
    setOperation(undefined);
    setPropertyType(undefined);
    setMinPrice('');
    setMaxPrice('');
    setBedrooms(undefined);
  };

  const handleApply = () => {
    onApply({
      operation,
      propertyType,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      bedrooms,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Filtros</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.gray[600]} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Operation */}
            <Text style={styles.sectionTitle}>Tipo de operación</Text>
            <View style={styles.chipRow}>
              {OPERATIONS.map((op) => (
                <TouchableOpacity
                  key={op.key}
                  style={[
                    styles.chip,
                    operation === op.key && {
                      backgroundColor: op.color,
                      borderColor: op.color,
                    },
                  ]}
                  onPress={() =>
                    setOperation(operation === op.key ? undefined : op.key)
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      operation === op.key && { color: Colors.white },
                    ]}
                  >
                    {op.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Property type */}
            <Text style={styles.sectionTitle}>Tipo de inmueble</Text>
            <View style={styles.chipRow}>
              {PROPERTY_TYPES.map((pt) => (
                <TouchableOpacity
                  key={pt.key}
                  style={[
                    styles.typeChip,
                    propertyType === pt.key && styles.typeChipActive,
                  ]}
                  onPress={() =>
                    setPropertyType(
                      propertyType === pt.key ? undefined : pt.key,
                    )
                  }
                >
                  <Ionicons
                    name={pt.icon as any}
                    size={18}
                    color={
                      propertyType === pt.key
                        ? Colors.white
                        : Colors.gray[500]
                    }
                  />
                  <Text
                    style={[
                      styles.typeChipText,
                      propertyType === pt.key && { color: Colors.white },
                    ]}
                  >
                    {pt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Price range */}
            <Text style={styles.sectionTitle}>Rango de precio (USD)</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                placeholder="Mín"
                placeholderTextColor={Colors.gray[400]}
                value={minPrice}
                onChangeText={setMinPrice}
                keyboardType="numeric"
              />
              <Text style={styles.priceSep}>—</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Máx"
                placeholderTextColor={Colors.gray[400]}
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="numeric"
              />
            </View>

            {/* Bedrooms */}
            <Text style={styles.sectionTitle}>Dormitorios</Text>
            <View style={styles.chipRow}>
              {BEDROOM_OPTIONS.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.bedChip,
                    bedrooms === n && styles.bedChipActive,
                  ]}
                  onPress={() => setBedrooms(bedrooms === n ? undefined : n)}
                >
                  <Text
                    style={[
                      styles.bedChipText,
                      bedrooms === n && { color: Colors.white },
                    ]}
                  >
                    {n === 5 ? '5+' : n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>
                {resultCount != null
                  ? `Ver ${resultCount} propiedades`
                  : 'Aplicar filtros'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray[300],
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  sectionTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.gray[700],
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
    backgroundColor: Colors.white,
  },
  chipText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.gray[600],
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
    backgroundColor: Colors.white,
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChipText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.gray[600],
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    fontSize: Fonts.sizes.md,
    color: Colors.gray[900],
  },
  priceSep: {
    fontSize: Fonts.sizes.lg,
    color: Colors.gray[400],
  },
  bedChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bedChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  bedChipText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: Colors.gray[600],
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xxl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.gray[300],
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
    color: Colors.gray[600],
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
