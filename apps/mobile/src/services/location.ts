import * as Location from 'expo-location';

export interface LocationSample {
  lat: number;
  lng: number;
  speedKmh: number;
  altitudeM: number | null;
  heading: number | null;
  recordedAt: string;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export function watchLocation(
  onSample: (s: LocationSample) => void,
  opts?: { intervalMs?: number; distanceM?: number },
): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: opts?.intervalMs ?? 2000,
      distanceInterval: opts?.distanceM ?? 5,
    },
    (loc) => {
      onSample({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        speedKmh: (loc.coords.speed ?? 0) * 3.6,
        altitudeM: loc.coords.altitude ?? null,
        heading: loc.coords.heading ?? null,
        recordedAt: new Date(loc.timestamp).toISOString(),
      });
    },
  );
}
