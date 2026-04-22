import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ridesApi, type RideListItem } from '../services/api';
import { getDeviceId } from '../services/device';
import { colors, spacing, typography } from '../theme';
import { formatDateTime, formatDuration } from '../utils/geo';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getDeviceId().then((id) => {
      if (mounted) setDeviceId(id);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['rides', deviceId],
    queryFn: () =>
      ridesApi.list({ deviceId: deviceId as string, limit: 30 }),
    enabled: !!deviceId,
  });

  useFocusEffect(
    useCallback(() => {
      if (deviceId) refetch();
    }, [deviceId, refetch]),
  );

  const items = data ?? [];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>기록</Text>
        <Text style={styles.caption}>내 주행 히스토리 · 최근 30건</Text>
      </View>

      {isLoading && !data ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptySub}>불러오는 중...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyTitle}>불러오지 못했습니다</Text>
          <Text style={styles.emptySub}>
            {(error as Error)?.message ?? '네트워크 오류'}
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerBox}>
          <View style={styles.iconWrap}>
            <Ionicons name="time-outline" size={32} color={colors.textSubtle} />
          </View>
          <Text style={styles.emptyTitle}>아직 기록이 없습니다</Text>
          <Text style={styles.emptySub}>
            주행을 시작하면 이곳에 자동으로 기록됩니다.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.text}
            />
          }
          renderItem={({ item }) => (
            <RideRow
              item={item}
              onPress={() =>
                navigation.navigate('RideDetail', { rideId: item.id })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function RideRow({ item, onPress }: { item: RideListItem; onPress: () => void }) {
  const inProgress = item.status === 'IN_PROGRESS' || !item.endedAt;
  const distance =
    item.totalDistanceKm != null && item.totalDistanceKm > 0
      ? `${item.totalDistanceKm.toFixed(2)} km`
      : inProgress
        ? '진행 중'
        : '-';
  const duration = formatDuration(item.movingTimeSec ?? undefined);
  const avg =
    item.avgSpeedKmh != null && item.avgSpeedKmh > 0
      ? `${item.avgSpeedKmh.toFixed(1)} km/h`
      : '-';

  return (
    <Pressable onPress={onPress} style={styles.row} android_ripple={{ color: colors.divider }}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowDate}>{formatDateTime(item.startedAt)}</Text>
        {inProgress ? (
          <View style={styles.statusTag}>
            <Text style={styles.statusText}>진행 중</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.rowCourse} numberOfLines={1}>
        {item.courseName ?? '코스 없음'}
      </Text>

      <View style={styles.rowStats}>
        <Stat label="거리" value={distance} />
        <Stat label="시간" value={duration} />
        <Stat label="평균속도" value={avg} />
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.text },
  caption: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.h3, color: colors.text },
  emptySub: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
  },
  retryText: { ...typography.bodyBold, color: colors.text },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sep: { height: 1, backgroundColor: colors.divider },
  row: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowDate: { ...typography.caption, color: colors.textMuted },
  statusTag: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.bgInverse,
  },
  statusText: {
    ...typography.caption,
    color: colors.textInverse,
    fontWeight: '700',
  },
  rowCourse: { ...typography.bodyBold, color: colors.text, marginTop: 2 },
  rowStats: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.lg,
  },
  stat: {
    flex: 1,
  },
  statLabel: { ...typography.caption, color: colors.textMuted },
  statValue: { ...typography.body, color: colors.text, fontWeight: '600', marginTop: 2 },
});
