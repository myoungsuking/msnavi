import { useEffect, useRef } from 'react';
import type * as Location from 'expo-location';
import {
  requestLocationPermission,
  watchLocation,
  type LocationSample,
} from '../services/location';
import { useSettingsStore } from '../store/settingsStore';

export function useRideTracking(
  enabled: boolean,
  onSample: (s: LocationSample) => void,
) {
  const gpsIntervalMs = useSettingsStore((s) => s.gpsIntervalMs);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!enabled) return;
      const granted = await requestLocationPermission();
      if (!granted) return;
      if (cancelled) return;
      subRef.current = await watchLocation(onSample, { intervalMs: gpsIntervalMs });
    }

    start();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [enabled, gpsIntervalMs, onSample]);
}
