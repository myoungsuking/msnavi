import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigationStore } from '../store/navigationStore';
import { useNearbyPois } from '../hooks/useNearbyPois';
import { NearbyList } from '../components/NearbyList';
import { colors, spacing, typography } from '../theme';

const TYPES: Array<{ id: string; label: string }> = [
  { id: 'certification_center', label: '인증센터' },
  { id: 'restroom', label: '화장실' },
  { id: 'water_station', label: '급수대' },
  { id: 'air_pump', label: '공기주입기' },
  { id: 'convenience_store', label: '편의점' },
  { id: 'restaurant', label: '식당' },
  { id: 'lodging', label: '숙소' },
  { id: 'cafe', label: '카페' },
  { id: 'bike_repair', label: '자전거 수리' },
];

export function NearbyScreen() {
  const current = useNavigationStore((s) => s.currentLocation);
  const [type, setType] = useState<string>('convenience_store');

  const { data, isLoading } = useNearbyPois({
    lat: current?.lat,
    lng: current?.lng,
    type,
    radius: 2000,
    source: 'auto',
  });

  if (!current) {
    return (
      <SafeAreaView style={styles.empty}>
        <Text style={styles.emptyText}>
          현재 위치를 가져올 수 없습니다. 라이딩 화면에서 위치 권한을 허용하세요.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {TYPES.map((t) => {
          const active = t.id === type;
          return (
            <Pressable
              key={t.id}
              onPress={() => setType(t.id)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <Text style={styles.loading}>불러오는 중...</Text>
        ) : (
          <NearbyList items={data ?? []} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabs: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.divider,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.bg,
  },
  tabActive: {
    backgroundColor: colors.bgInverse,
    borderColor: colors.bgInverse,
  },
  tabText: { color: colors.text, ...typography.caption, fontWeight: '600' },
  tabTextActive: { color: colors.textInverse },
  loading: {
    padding: spacing.xl,
    textAlign: 'center',
    color: colors.textMuted,
    ...typography.body,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  emptyText: {
    color: colors.textMuted,
    ...typography.body,
    textAlign: 'center',
  },
});
