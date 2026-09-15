import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../src/constants/theme';
import api from '../src/services/api';

interface PropertyStat {
  id: string;
  title: string;
  views_count: number;
  contacts_count: number;
}

interface Stats {
  total_views: number;
  total_contacts: number | null;
  properties: PropertyStat[];
  locked: boolean;
}

export default function StatsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get('/properties/mine/stats')
      .then((r) => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const maxViews = Math.max(1, ...(stats?.properties.map((p) => p.views_count) ?? [1]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.header}>Mis estadísticas</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !stats ? (
        <View style={styles.center}>
          <Ionicons name="stats-chart-outline" size={64} color={Colors.gray[300]} />
          <Text style={styles.emptyText}>No se pudieron cargar tus estadísticas</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.total_views}</Text>
              <Text style={styles.summaryLabel}>Vistas totales</Text>
            </View>
            {!stats.locked && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{stats.total_contacts}</Text>
                <Text style={styles.summaryLabel}>Contactos por WhatsApp</Text>
              </View>
            )}
          </View>

          {stats.locked ? (
            <View style={styles.center}>
              <Ionicons name="lock-closed-outline" size={48} color={Colors.gray[300]} />
              <Text style={styles.emptyText}>
                El desglose por propiedad y los contactos son parte de los planes con estadísticas incluidas.
              </Text>
              <TouchableOpacity onPress={() => router.push('/subscription')}>
                <Text style={styles.link}>Ver planes</Text>
              </TouchableOpacity>
            </View>
          ) : stats.properties.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Todavía no tenés propiedades publicadas</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Por propiedad</Text>
              {stats.properties.map((p) => (
                <View key={p.id} style={styles.propertyRow}>
                  <Text style={styles.propertyTitle} numberOfLines={1}>{p.title}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${(p.views_count / maxViews) * 100}%` }]} />
                  </View>
                  <Text style={styles.propertyMeta}>{p.views_count} vistas · {p.contacts_count} contactos</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingTop: 60 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: Spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  header: { flex: 1, fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.gray[900] },
  emptyText: { color: Colors.gray[500], fontSize: Fonts.sizes.md, textAlign: 'center', paddingHorizontal: Spacing.xl },
  link: { color: Colors.primary, fontWeight: '700', fontSize: Fonts.sizes.md, marginTop: Spacing.sm },
  summaryRow: { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.gray[50],
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  summaryValue: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.primary },
  summaryLabel: { fontSize: Fonts.sizes.sm, color: Colors.gray[600], marginTop: 4, textAlign: 'center' },
  sectionTitle: {
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    color: Colors.gray[900],
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  propertyRow: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  propertyTitle: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.gray[900], marginBottom: 6 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.gray[100], overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  propertyMeta: { fontSize: Fonts.sizes.xs, color: Colors.gray[500], marginTop: 4 },
});
