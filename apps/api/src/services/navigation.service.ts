import { getCoursePolyline, listCoursePois } from './course.service';
import { haversineMeters, snapToPolyline, type LatLng } from '../utils/geo';

export interface ProgressInput {
  courseId: number;
  lat: number;
  lng: number;
  speedKmh?: number;
  /** 이탈 감지 임계값(m). 기본 50m */
  offRouteThresholdM?: number;
}

export interface ProgressResult {
  snapped: LatLng;
  progressKm: number;
  totalKm: number;
  remainingDistanceKm: number;
  estimatedDurationMin: number | null;
  estimatedArrivalAt: string | null;
  offRoute: boolean;
  offRouteDistanceM: number;
  nextPoi: {
    id: number;
    type: string;
    name: string;
    lat: number;
    lng: number;
    distanceKm: number;
  } | null;
}

export async function computeProgress(input: ProgressInput): Promise<ProgressResult> {
  const poly = await getCoursePolyline(input.courseId);
  if (poly.length < 2) {
    return {
      snapped: { lat: input.lat, lng: input.lng },
      progressKm: 0,
      totalKm: 0,
      remainingDistanceKm: 0,
      estimatedDurationMin: null,
      estimatedArrivalAt: null,
      offRoute: false,
      offRouteDistanceM: 0,
      nextPoi: null,
    };
  }

  const snap = snapToPolyline({ lat: input.lat, lng: input.lng }, poly);

  const threshold = input.offRouteThresholdM ?? 50;
  const offRoute = snap.offRouteMeters > threshold;

  const remainingM = Math.max(0, snap.totalMeters - snap.progressMeters);
  const remainingKm = remainingM / 1000;

  let estimatedDurationMin: number | null = null;
  let estimatedArrivalAt: string | null = null;
  if (input.speedKmh && input.speedKmh > 1) {
    estimatedDurationMin = Math.round((remainingKm / input.speedKmh) * 60);
    estimatedArrivalAt = new Date(Date.now() + estimatedDurationMin * 60_000).toISOString();
  }

  // 다음 인증센터 계산: 현재 위치에서 polyline 상 앞쪽에 있는 인증센터 중 가장 가까운 것
  const pois = await listCoursePois(input.courseId, 'certification_center');
  let nextPoi: ProgressResult['nextPoi'] = null;
  if (pois.length > 0) {
    // 각 POI 도 polyline에 스냅하여 경로상 위치를 얻는다
    const enriched = pois.map((p) => {
      const s = snapToPolyline({ lat: Number(p.lat), lng: Number(p.lng) }, poly);
      return { poi: p, progressM: s.progressMeters };
    });
    // 현재 진행거리보다 앞쪽에 있는 POI들 중 가장 가까운 순
    const ahead = enriched
      .filter((e) => e.progressM > snap.progressMeters + 1)
      .sort((a, b) => a.progressM - b.progressM);
    if (ahead.length > 0) {
      const p = ahead[0].poi;
      const distM = haversineMeters(
        { lat: snap.snapped.lat, lng: snap.snapped.lng },
        { lat: Number(p.lat), lng: Number(p.lng) },
      );
      nextPoi = {
        id: p.id,
        type: p.type,
        name: p.name,
        lat: Number(p.lat),
        lng: Number(p.lng),
        distanceKm: Number((distM / 1000).toFixed(2)),
      };
    }
  }

  return {
    snapped: snap.snapped,
    progressKm: Number((snap.progressMeters / 1000).toFixed(3)),
    totalKm: Number((snap.totalMeters / 1000).toFixed(3)),
    remainingDistanceKm: Number(remainingKm.toFixed(3)),
    estimatedDurationMin,
    estimatedArrivalAt,
    offRoute,
    offRouteDistanceM: Math.round(snap.offRouteMeters),
    nextPoi,
  };
}
