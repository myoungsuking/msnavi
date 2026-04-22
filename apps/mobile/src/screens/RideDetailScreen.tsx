import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { ridesApi } from '../services/api';
import { colors, spacing, typography } from '../theme';
import { formatDateTime, formatDuration } from '../utils/geo';
import type { RootStackParamList } from '../navigation/types';

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function RideDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<RootStackParamList, 'RideDetail'>>();
  const { rideId } = route.params;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ride', rideId],
    queryFn: () => ridesApi.get(rideId),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>불러오는 중...</Text>
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>불러오지 못했습니다</Text>
        <Text style={styles.muted}>{(error as Error)?.message ?? '오류'}</Text>
      </View>
    );
  }

  const s = data.session;
  const points = data.trackPoints ?? [];
  const inProgress = s.status === 'IN_PROGRESS' || !s.ended_at;

  const totalKm = num(s.total_distance_km);
  const avg = num(s.avg_speed_kmh);
  const max = num(s.max_speed_kmh);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: spacing.lg + insets.bottom },
      ]}
    >
      <Text style={styles.caption}>주행 ID #{s.id}</Text>
      <Text style={styles.title}>
        {formatDateTime(s.started_at)}
      </Text>
      {inProgress ? (
        <View style={styles.statusTag}>
          <Text style={styles.statusText}>진행 중</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Row label="시작 시간" value={formatDateTime(s.started_at)} />
        <Row label="종료 시간" value={formatDateTime(s.ended_at)} />
        <Row label="상태" value={s.status} />
      </View>

      <View style={styles.section}>
        <Row
          label="주행 거리"
          value={totalKm != null ? `${totalKm.toFixed(2)} km` : '-'}
        />
        <Row label="이동 시간" value={formatDuration(s.moving_time_sec)} />
        <Row label="정지 시간" value={formatDuration(s.stopped_time_sec)} />
        <Row
          label="평균 속도"
          value={avg != null ? `${avg.toFixed(1)} km/h` : '-'}
        />
        <Row
          label="최고 속도"
          value={max != null ? `${max.toFixed(1)} km/h` : '-'}
        />
      </View>

      <View style={styles.section}>
        <Row label="기록된 위치 포인트" value={`${points.length}개`} />
        {points.length >= 2 ? (
          <>
            <Row
              label="첫 포인트"
              value={`${points[0].lat.toFixed(5)}, ${points[0].lng.toFixed(5)}`}
            />
            <Row
              label="마지막 포인트"
              value={`${points[points.length - 1].lat.toFixed(5)}, ${points[
                points.length - 1
              ].lng.toFixed(5)}`}
            />
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  title: { ...typography.h2, color: colors.text, marginTop: 2 },
  caption: { ...typography.caption, color: colors.textMuted },
  muted: { ...typography.body, color: colors.textMuted },
  statusTag: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.bgInverse,
    marginTop: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    color: colors.textInverse,
    fontWeight: '700',
  },
  section: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.divider,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
    width: 110,
  },
  rowValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
});
