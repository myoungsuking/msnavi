import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNavigationStore } from '../store/navigationStore';
import { useCourseSegments, useCoursePois } from '../hooks/useCourse';
import { useRideTracking } from '../hooks/useRideTracking';
import { navigationApi, ridesApi } from '../services/api';
import { RouteMap } from '../components/RouteMap';
import { RideStatsPanel } from '../components/RideStatsPanel';
import { MonoButton } from '../components/MonoButton';
import { useRideStore } from '../store/rideStore';
import type { LocationSample } from '../services/location';
import { colors, spacing, typography } from '../theme';

export function RideScreen() {
  const courseId = useNavigationStore((s) => s.selectedCourseId);
  const setCurrent = useNavigationStore((s) => s.setCurrentLocation);
  const setProgress = useNavigationStore((s) => s.setProgress);
  const current = useNavigationStore((s) => s.currentLocation);
  const snapped = useNavigationStore((s) => s.snappedLocation);
  const remainingKm = useNavigationStore((s) => s.remainingDistanceKm);
  const etaMin = useNavigationStore((s) => s.estimatedDurationMin);
  const etaIso = useNavigationStore((s) => s.estimatedArrivalAt);
  const offRoute = useNavigationStore((s) => s.offRoute);
  const nextName = useNavigationStore((s) => s.nextPoiName);
  const nextDist = useNavigationStore((s) => s.nextPoiDistanceKm);

  const rideId = useRideStore((s) => s.rideId);
  const startRide = useRideStore((s) => s.startRide);
  const endRide = useRideStore((s) => s.endRide);

  const [lastProgressAt, setLastProgressAt] = useState(0);

  const { data: segments } = useCourseSegments(courseId);
  const { data: certPois } = useCoursePois(courseId, 'certification_center');

  const routeCoords = useMemo(() => {
    const acc: { latitude: number; longitude: number }[] = [];
    for (const seg of segments ?? []) {
      for (const c of seg.coordinates ?? []) {
        acc.push({ longitude: Number(c[0]), latitude: Number(c[1]) });
      }
    }
    return acc;
  }, [segments]);

  const certCoords = useMemo(
    () =>
      (certPois ?? []).map((p) => ({
        latitude: Number(p.lat),
        longitude: Number(p.lng),
        name: p.name,
      })),
    [certPois],
  );

  const onSample = useCallback(
    async (s: LocationSample) => {
      setCurrent({ lat: s.lat, lng: s.lng, speedKmh: s.speedKmh, heading: s.heading ?? undefined });
      if (!courseId) return;
      const now = Date.now();
      if (now - lastProgressAt < 2000) return;
      setLastProgressAt(now);
      try {
        const p = await navigationApi.progress({
          courseId,
          lat: s.lat,
          lng: s.lng,
          speedKmh: s.speedKmh,
        });
        setProgress({
          snapped: p.snapped,
          remainingDistanceKm: p.remainingDistanceKm,
          estimatedDurationMin: p.estimatedDurationMin,
          estimatedArrivalAt: p.estimatedArrivalAt,
          offRoute: p.offRoute,
          nextPoiName: p.nextPoi?.name ?? null,
          nextPoiDistanceKm: p.nextPoi?.distanceKm ?? null,
        });
        if (rideId) {
          ridesApi
            .track(rideId, [
              {
                lat: s.lat,
                lng: s.lng,
                speedKmh: s.speedKmh,
                altitudeM: s.altitudeM ?? undefined,
                recordedAt: s.recordedAt,
              },
            ])
            .catch(() => undefined);
        }
      } catch {
        /* ignore network errors during tracking */
      }
    },
    [courseId, lastProgressAt, rideId, setCurrent, setProgress],
  );

  useRideTracking(true, onSample);

  useEffect(() => {
    return () => {
      // 화면 벗어날 때 ride 종료
      if (rideId) {
        ridesApi.end(rideId, {}).catch(() => undefined);
        endRide();
      }
    };
  }, [endRide, rideId]);

  if (!courseId) {
    return (
      <SafeAreaView style={styles.empty}>
        <Text style={styles.emptyText}>홈에서 코스를 먼저 선택하세요.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        <RouteMap
          currentLocation={
            current ? { latitude: current.lat, longitude: current.lng } : null
          }
          snappedLocation={
            snapped ? { latitude: snapped.lat, longitude: snapped.lng } : null
          }
          routeCoords={routeCoords}
          certificationCenters={certCoords}
        />
      </View>

      <RideStatsPanel
        currentSpeedKmh={current?.speedKmh}
        remainingKm={remainingKm}
        etaIso={etaIso}
        etaDurationMin={etaMin}
        nextPoiName={nextName}
        nextPoiDistanceKm={nextDist}
        offRoute={offRoute}
      />

      <View style={styles.btnRow}>
        {!rideId ? (
          <MonoButton
            label="주행 시작"
            onPress={async () => {
              try {
                const s = await ridesApi.start({ courseId });
                startRide(s.id);
              } catch {
                /* ignore */
              }
            }}
          />
        ) : (
          <MonoButton
            label="주행 종료"
            variant="outline"
            onPress={async () => {
              try {
                await ridesApi.end(rideId, {});
              } finally {
                endRide();
              }
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  emptyText: { ...typography.body, color: colors.textMuted },
  btnRow: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
  },
});
