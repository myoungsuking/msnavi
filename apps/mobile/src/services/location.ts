import * as Location from 'expo-location';

export interface LocationSample {
  lat: number;
  lng: number;
  speedKmh: number;
  altitudeM: number | null;
  heading: number | null;
  accuracyM: number | null;
  recordedAt: string;
}

export interface CompassSample {
  /** 진북 기준 heading (0~360). 하드웨어/드라이버에 따라 magnetic 일 수 있음. */
  trueHeading: number | null;
  magneticHeading: number | null;
  /** 0(unreliable) ~ 3(high). expo-location 의 accuracy 는 정수. */
  accuracy: number | null;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

// 자전거 상한속도(60km/h) 초과 샘플은 GPS 튐으로 간주하고 드롭.
const MAX_BIKE_SPEED_KMH = 60;
// 정확도 50m 이상은 도심 빌딩숲 등 열악한 환경. 내비 스냅에는 부적합.
const MAX_ACCURACY_M = 50;

/**
 * GPS 위치 스트림 구독. onSample 은 sanity 통과한 샘플만 받는다.
 * - accuracy > 50m 샘플 드롭
 * - 직전 샘플 대비 속도 > 60km/h 급 튐 드롭 (샘플 시간 0.5s 이하 jitter 는 제외)
 */
export function watchLocation(
  onSample: (s: LocationSample) => void,
  opts?: { intervalMs?: number; distanceM?: number },
): Promise<Location.LocationSubscription> {
  let prev: { lat: number; lng: number; t: number } | null = null;

  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: opts?.intervalMs ?? 2000,
      distanceInterval: opts?.distanceM ?? 5,
    },
    (loc) => {
      const accuracy = loc.coords.accuracy ?? null;
      if (accuracy != null && accuracy > MAX_ACCURACY_M) {
        return; // 저정확도 샘플 드롭
      }

      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      const t = loc.timestamp;

      // 속도 기반 sanity: 직전 샘플과의 순간속도가 60km/h 를 넘으면 튐으로 간주
      if (prev && t > prev.t) {
        const dtSec = (t - prev.t) / 1000;
        if (dtSec > 0.5) {
          const distM = haversineSimple(prev.lat, prev.lng, lat, lng);
          const vKmh = (distM / dtSec) * 3.6;
          if (vKmh > MAX_BIKE_SPEED_KMH) {
            return;
          }
        }
      }
      prev = { lat, lng, t };

      onSample({
        lat,
        lng,
        speedKmh: (loc.coords.speed ?? 0) * 3.6,
        altitudeM: loc.coords.altitude ?? null,
        heading: loc.coords.heading ?? null,
        accuracyM: accuracy,
        recordedAt: new Date(t).toISOString(),
      });
    },
  );
}

/**
 * 기기 나침반(자이로+자력계) heading 구독.
 * expo-location 의 watchHeadingAsync 는 iOS/Android 공용 API.
 */
export function watchCompassHeading(
  onHeading: (h: CompassSample) => void,
): Promise<Location.LocationSubscription> {
  return Location.watchHeadingAsync((h) => {
    // 일부 단말에서 magneticHeading 이 -1(unknown) 로 올 수 있음
    const mag = Number.isFinite(h.magHeading) && h.magHeading >= 0 ? h.magHeading : null;
    const tru = Number.isFinite(h.trueHeading) && h.trueHeading >= 0 ? h.trueHeading : null;
    onHeading({
      trueHeading: tru,
      magneticHeading: mag,
      accuracy: h.accuracy ?? null,
    });
  });
}

// 모듈 내부 전용 간이 haversine (utils/geo 의존성 순환 회피)
function haversineSimple(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
