import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface Props {
  currentSpeedKmh?: number;
  remainingKm?: number;
  etaIso?: string | null;
  etaDurationMin?: number | null;
  nextPoiName?: string | null;
  nextPoiDistanceKm?: number | null;
  offRoute?: boolean;
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function RideStatsPanel({
  currentSpeedKmh,
  remainingKm,
  etaIso,
  etaDurationMin,
  nextPoiName,
  nextPoiDistanceKm,
  offRoute,
}: Props) {
  return (
    <View style={styles.wrap}>
      {offRoute && (
        <View style={styles.offRoute}>
          <Text style={styles.offRouteText}>경로 이탈</Text>
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.label}>속도</Text>
          <Text style={styles.value}>
            {currentSpeedKmh != null ? currentSpeedKmh.toFixed(1) : '-'}
          </Text>
          <Text style={styles.unit}>km/h</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>남은 거리</Text>
          <Text style={styles.value}>
            {remainingKm != null ? remainingKm.toFixed(1) : '-'}
          </Text>
          <Text style={styles.unit}>km</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>도착 예정</Text>
          <Text style={styles.value}>{fmtTime(etaIso)}</Text>
          <Text style={styles.unit}>
            {etaDurationMin != null ? `${etaDurationMin}분` : '-'}
          </Text>
        </View>
      </View>

      <View style={styles.nextRow}>
        <Text style={styles.label}>다음 인증센터</Text>
        <Text style={styles.nextText}>
          {nextPoiName ?? '-'}
          {nextPoiDistanceKm != null ? `  ·  ${nextPoiDistanceKm.toFixed(1)} km` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  offRoute: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  offRouteText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  value: {
    ...typography.h1,
    color: colors.text,
  },
  unit: {
    ...typography.caption,
    color: colors.textMuted,
  },
  nextRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.divider,
  },
  nextText: {
    ...typography.bodyBold,
    color: colors.text,
    marginTop: 2,
  },
});
