import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import type { NearbyItem } from '../services/api';

interface Props {
  items: NearbyItem[];
  ListEmptyLabel?: string;
}

export function NearbyList({ items, ListEmptyLabel = '결과 없음' }: Props) {
  return (
    <FlatList
      data={items}
      keyExtractor={(it, idx) => String(it.id ?? idx)}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      ListEmptyComponent={<Text style={styles.empty}>{ListEmptyLabel}</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.sub}>
              {translateType(item.type)} · {item.address ?? '-'}
            </Text>
          </View>
          <Text style={styles.dist}>{formatDistance(item.distanceM)}</Text>
        </View>
      )}
    />
  );
}

function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function translateType(t: string) {
  const map: Record<string, string> = {
    certification_center: '인증센터',
    convenience_store: '편의점',
    restroom: '화장실',
    restaurant: '식당',
    lodging: '숙소',
    cafe: '카페',
    bike_repair: '자전거 수리',
    shelter: '쉼터',
  };
  return map[t] ?? t;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
  },
  sep: {
    height: 1,
    backgroundColor: colors.divider,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
  },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  dist: {
    ...typography.bodyBold,
    color: colors.text,
    marginLeft: spacing.md,
  },
  empty: {
    padding: spacing.xl,
    textAlign: 'center',
    color: colors.textMuted,
    ...typography.body,
  },
});
