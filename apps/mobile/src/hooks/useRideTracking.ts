import { useEffect, useRef } from 'react';
import type * as Location from 'expo-location';
import {
  requestLocationPermission,
  watchCompassHeading,
  watchLocation,
  type CompassSample,
  type LocationSample,
} from '../services/location';
import { useSettingsStore } from '../store/settingsStore';
import { useNavigationStore } from '../store/navigationStore';
import { fuseHeading, smoothHeading } from '../utils/heading';

/**
 * 주행 중 GPS 와 나침반을 동시에 구독.
 * - GPS 샘플은 기존대로 onSample 로 전달
 * - heading 은 GPS heading + compass 를 속도에 따라 fusion + EMA smoothing 하여
 *   navigationStore.displayHeading 에 반영 (지도 마커 회전용)
 */
export function useRideTracking(
  enabled: boolean,
  onSample: (s: LocationSample) => void,
) {
  const gpsIntervalMs = useSettingsStore((s) => s.gpsIntervalMs);
  const setDisplayHeading = useNavigationStore((s) => s.setDisplayHeading);

  const gpsSubRef = useRef<Location.LocationSubscription | null>(null);
  const compassSubRef = useRef<Location.LocationSubscription | null>(null);

  // fusion 최신 소스 보관 (두 스트림 중 어느 쪽이든 올 때마다 재계산)
  const sourcesRef = useRef<{
    gpsHeading: number | null;
    gpsSpeedKmh: number | null;
    compassHeading: number | null;
  }>({ gpsHeading: null, gpsSpeedKmh: null, compassHeading: null });

  const smoothedRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const recomputeHeading = () => {
      const fused = fuseHeading(sourcesRef.current);
      if (fused == null) {
        smoothedRef.current = null;
        setDisplayHeading(null);
        return;
      }
      const next = smoothHeading(smoothedRef.current, fused, 0.3);
      smoothedRef.current = next;
      setDisplayHeading(next);
    };

    async function start() {
      if (!enabled) return;
      const granted = await requestLocationPermission();
      if (!granted) return;
      if (cancelled) return;

      gpsSubRef.current = await watchLocation((s) => {
        sourcesRef.current.gpsHeading = s.heading;
        sourcesRef.current.gpsSpeedKmh = s.speedKmh;
        recomputeHeading();
        onSample(s);
      }, { intervalMs: gpsIntervalMs });

      try {
        compassSubRef.current = await watchCompassHeading((h: CompassSample) => {
          // trueHeading 우선, 없으면 magnetic
          const v = h.trueHeading ?? h.magneticHeading;
          if (v != null) {
            sourcesRef.current.compassHeading = v;
            recomputeHeading();
          }
        });
      } catch {
        // 나침반 미지원 단말은 GPS heading 만으로 동작
      }
    }

    start();

    return () => {
      cancelled = true;
      gpsSubRef.current?.remove();
      gpsSubRef.current = null;
      compassSubRef.current?.remove();
      compassSubRef.current = null;
      smoothedRef.current = null;
    };
  }, [enabled, gpsIntervalMs, onSample, setDisplayHeading]);
}
