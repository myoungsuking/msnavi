import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import type { NearbyItem } from '../services/api';

interface Props {
  items: NearbyItem[];
  ListEmptyLabel?: string;
  onItemPress?: (item: NearbyItem) => void;
  /** 리스트에서 시각적으로 강조할 항목의 id */
  highlightedId?: string | number | null;
}

export function NearbyList({
  items,
  ListEmptyLabel = '결과 없음',
  onItemPress,
  highlightedId,
}: Props) {
  return (
    <FlatList
      data={items}
      keyExtractor={(it, idx) => String(it.id ?? idx)}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      ListEmptyComponent={<Text style={styles.empty}>{ListEmptyLabel}</Text>}
      renderItem={({ item }) => {
        const isSelected =
          highlightedId != null && item.id === highlightedId;
        return (
          <Pressable
            onPress={onItemPress ? () => onItemPress(item) : undefined}
            disabled={!onItemPress}
            style={({ pressed }) => [
              styles.row,
              isSelected && styles.rowSelected,
              pressed && onItemPress ? styles.rowPressed : null,
            ]}
            accessibilityRole={onItemPress ? 'button' : undefined}
            accessibilityLabel={
              onItemPress ? `${item.name} 위치 보기` : undefined
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>
                {translateType(item.type)} · {item.address ?? '-'}
              </Text>
            </View>
            <Text style={styles.dist}>{formatDistance(item.distanceM)}</Text>
            {onItemPress ? <Text style={styles.chevron}>›</Text> : null}
          </Pressable>
        );
      }}
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
    restroom: '화장실',
    water_station: '급수대',
    air_pump: '공기주입기',
    convenience_store: '편의점',
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
  rowPressed: {
    backgroundColor: colors.divider,
  },
  rowSelected: {
    backgroundColor: '#F5F5F5',
    borderLeftWidth: 3,
    borderLeftColor: colors.borderStrong,
  },
  chevron: {
    marginLeft: spacing.sm,
    color: colors.textSubtle,
    fontSize: 22,
    lineHeight: 22,
  },
  empty: {
    padding: spacing.xl,
    textAlign: 'center',
    color: colors.textMuted,
    ...typography.body,
  },
});
