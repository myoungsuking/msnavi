/**
 * 지리/경로 관련 유틸
 */

const EARTH_RADIUS_M = 6371008.8;

export interface LatLng {
  lat: number;
  lng: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * 두 좌표 사이의 거리 (미터) - Haversine
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * 선분 AB에 대한 점 P의 최근접점을 구한다.
 * 위경도 좌표를 로컬 평면 근사(equirectangular)로 계산 - 짧은 구간에서 정확.
 */
export function closestPointOnSegment(p: LatLng, a: LatLng, b: LatLng): {
  point: LatLng;
  distanceMeters: number;
  t: number; // [0,1] 구간 위치
} {
  const refLat = toRad((a.lat + b.lat) / 2);
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(refLat);

  const ax = a.lng * mPerDegLng;
  const ay = a.lat * mPerDegLat;
  const bx = b.lng * mPerDegLng;
  const by = b.lat * mPerDegLat;
  const px = p.lng * mPerDegLng;
  const py = p.lat * mPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;

  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const distM = Math.hypot(px - cx, py - cy);

  const point: LatLng = {
    lat: cy / mPerDegLat,
    lng: cx / mPerDegLng,
  };
  return { point, distanceMeters: distM, t };
}

/**
 * polyline(위경도 배열)을 따라 누적 거리 배열 반환 (미터)
 */
export function cumulativeDistancesMeters(poly: LatLng[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < poly.length; i++) {
    out.push(out[i - 1] + haversineMeters(poly[i - 1], poly[i]));
  }
  return out;
}

export interface SnapResult {
  snapped: LatLng;
  progressMeters: number;
  totalMeters: number;
  offRouteMeters: number;
  segmentIndex: number;
  /** 선분 tangent bearing (진북 기준 시계방향, 0~360). 경로 진행방향을 의미. */
  bearingDeg: number;
}

export interface SnapOptions {
  /**
   * 직전 샘플의 segmentIndex. 주어지면 `fromSegmentIndex ± windowK` 내에서만 먼저 탐색하여 O(K) 로 스냅.
   * 윈도우 내 최단거리가 `offRouteFallbackM` 보다 크면 full-scan 으로 fallback.
   */
  fromSegmentIndex?: number;
  /** 로컬 윈도우 반지름(선분 수). 기본 50. */
  windowK?: number;
  /** 윈도우 내 최단거리가 이 값보다 크면 full-scan fallback. 기본 100m. */
  offRouteFallbackM?: number;
}

function segmentBearing(a: LatLng, b: LatLng): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const φ1 = toR(a.lat);
  const φ2 = toR(b.lat);
  const Δλ = toR(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * polyline 상 특정 선분 범위에 대해 최근접 스냅을 찾는다 (내부 유틸).
 */
function snapInRange(
  p: LatLng,
  poly: LatLng[],
  cum: number[],
  lo: number,
  hi: number,
): {
  dist: number;
  snapped: LatLng;
  progress: number;
  segIdx: number;
  bearing: number;
} {
  let bestDist = Number.POSITIVE_INFINITY;
  let bestSnap: LatLng = poly[lo];
  let bestProgress = cum[lo];
  let bestSegIdx = lo;
  let bestBearing = 0;

  for (let i = lo; i < hi; i++) {
    const { point, distanceMeters, t } = closestPointOnSegment(p, poly[i], poly[i + 1]);
    if (distanceMeters < bestDist) {
      bestDist = distanceMeters;
      bestSnap = point;
      const segLen = cum[i + 1] - cum[i];
      bestProgress = cum[i] + t * segLen;
      bestSegIdx = i;
      bestBearing = segmentBearing(poly[i], poly[i + 1]);
    }
  }

  return {
    dist: bestDist,
    snapped: bestSnap,
    progress: bestProgress,
    segIdx: bestSegIdx,
    bearing: bestBearing,
  };
}

/**
 * 점 p를 polyline 위 최근접 지점으로 스냅하고,
 * 시작점으로부터의 누적 거리(미터), 이탈거리(미터), 선분 bearing 을 반환.
 *
 * 성능: polyline 이 수천 vertex 일 때 매 샘플마다 O(N) 전탐색은 비용이 크다.
 * 직전 `segmentIndex` 를 전달하면 그 주변 ±windowK 만 먼저 보고, 실패 시에만 full-scan 한다.
 */
export function snapToPolyline(
  p: LatLng,
  poly: LatLng[],
  opts: SnapOptions = {},
): SnapResult {
  if (poly.length < 2) {
    return {
      snapped: poly[0] ?? p,
      progressMeters: 0,
      totalMeters: 0,
      offRouteMeters: poly[0] ? haversineMeters(p, poly[0]) : 0,
      segmentIndex: 0,
      bearingDeg: 0,
    };
  }
  const cum = cumulativeDistancesMeters(poly);
  const totalMeters = cum[cum.length - 1];

  const windowK = opts.windowK ?? 50;
  const fallbackM = opts.offRouteFallbackM ?? 100;

  let best: ReturnType<typeof snapInRange> | null = null;

  if (
    typeof opts.fromSegmentIndex === 'number' &&
    opts.fromSegmentIndex >= 0 &&
    opts.fromSegmentIndex < poly.length - 1
  ) {
    const lo = Math.max(0, opts.fromSegmentIndex - windowK);
    const hi = Math.min(poly.length - 1, opts.fromSegmentIndex + windowK + 1);
    const local = snapInRange(p, poly, cum, lo, hi);
    if (local.dist <= fallbackM) {
      best = local;
    }
  }

  if (!best) {
    best = snapInRange(p, poly, cum, 0, poly.length - 1);
  }

  return {
    snapped: best.snapped,
    progressMeters: best.progress,
    totalMeters,
    offRouteMeters: best.dist,
    segmentIndex: best.segIdx,
    bearingDeg: best.bearing,
  };
}
