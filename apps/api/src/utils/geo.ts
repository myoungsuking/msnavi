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

/**
 * 점 p를 polyline 위 최근접 지점으로 스냅하고,
 * 시작점으로부터의 누적 거리(미터), 이탈거리(미터)를 반환.
 */
export function snapToPolyline(
  p: LatLng,
  poly: LatLng[],
): {
  snapped: LatLng;
  progressMeters: number;
  totalMeters: number;
  offRouteMeters: number;
  segmentIndex: number;
} {
  if (poly.length < 2) {
    return {
      snapped: poly[0] ?? p,
      progressMeters: 0,
      totalMeters: 0,
      offRouteMeters: poly[0] ? haversineMeters(p, poly[0]) : 0,
      segmentIndex: 0,
    };
  }
  const cum = cumulativeDistancesMeters(poly);
  const totalMeters = cum[cum.length - 1];

  let bestDist = Number.POSITIVE_INFINITY;
  let bestSnap: LatLng = poly[0];
  let bestProgress = 0;
  let bestSegIdx = 0;

  for (let i = 0; i < poly.length - 1; i++) {
    const { point, distanceMeters, t } = closestPointOnSegment(p, poly[i], poly[i + 1]);
    if (distanceMeters < bestDist) {
      bestDist = distanceMeters;
      bestSnap = point;
      const segLen = cum[i + 1] - cum[i];
      bestProgress = cum[i] + t * segLen;
      bestSegIdx = i;
    }
  }

  return {
    snapped: bestSnap,
    progressMeters: bestProgress,
    totalMeters,
    offRouteMeters: bestDist,
    segmentIndex: bestSegIdx,
  };
}
