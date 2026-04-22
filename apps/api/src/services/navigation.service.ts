import { getCoursePolyline, listPoisAlongCourse } from './course.service';
import { haversineMeters, snapToPolyline, type LatLng } from '../utils/geo';

export interface ProgressInput {
  courseId: number;
  lat: number;
  lng: number;
  speedKmh?: number;
  /** 사용자 현재 진행 방향 (0~360). 경로 방향과 비교해 headingMismatch 판단에 사용. */
  headingDeg?: number;
  /** 이탈 감지 임계값(m). 기본 40m. (자전거 기준, 자동차 대비 타이트) */
  offRouteThresholdM?: number;
  /** 직전 응답의 segmentIndex. 있으면 윈도우 탐색으로 가속. */
  lastSegmentIndex?: number;
}

export interface ProgressResult {
  snapped: LatLng;
  /** 현재 스냅 위치의 선분 인덱스. 클라가 다음 요청에 lastSegmentIndex 로 전달하면 가속됨. */
  segmentIndex: number;
  /** 스냅 지점에서 경로 진행방향(진북 기준 bearing, 0~360) */
  routeBearingDeg: number;
  progressKm: number;
  totalKm: number;
  remainingDistanceKm: number;
  estimatedDurationMin: number | null;
  estimatedArrivalAt: string | null;
  /**
   * 이탈 여부 (거리 단독 기준).
   * NOTE: 단발 이탈로는 UI 를 바로 흔들면 안 되고, 클라이언트가 "N초 이상 연속" 조건을 본 뒤 확정해야 한다.
   */
  offRoute: boolean;
  offRouteDistanceM: number;
  /**
   * 진행방향 체크: 사용자 heading 과 경로 tangent 의 각도차 > 90° 이면 true.
   * - headingDeg 가 없으면 false.
   * - 역주행 의심 신호. 이탈은 아니지만 재안내 / 방향 경고에 활용 가능.
   */
  headingMismatch: boolean;
  /** 진행방향-경로 bearing 의 부호있는 차이 (-180..180). headingDeg 없으면 null. */
  headingDeltaDeg: number | null;
  nextPoi: {
    id: number;
    type: string;
    name: string;
    lat: number;
    lng: number;
    distanceKm: number;
  } | null;
}

function signedBearingDelta(from: number, to: number): number {
  let d = ((to - from + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}

export async function computeProgress(input: ProgressInput): Promise<ProgressResult> {
  const poly = await getCoursePolyline(input.courseId);
  if (poly.length < 2) {
    return {
      snapped: { lat: input.lat, lng: input.lng },
      segmentIndex: 0,
      routeBearingDeg: 0,
      progressKm: 0,
      totalKm: 0,
      remainingDistanceKm: 0,
      estimatedDurationMin: null,
      estimatedArrivalAt: null,
      offRoute: false,
      offRouteDistanceM: 0,
      headingMismatch: false,
      headingDeltaDeg: null,
      nextPoi: null,
    };
  }

  const snap = snapToPolyline(
    { lat: input.lat, lng: input.lng },
    poly,
    { fromSegmentIndex: input.lastSegmentIndex, windowK: 50, offRouteFallbackM: 100 },
  );

  // 자전거 기준 이탈 임계값: 기본 40m. (이전 50m 에서 10m 타이트)
  const threshold = input.offRouteThresholdM ?? 40;
  const offRoute = snap.offRouteMeters > threshold;

  // 진행 방향 vs 경로 방향 비교
  let headingDeltaDeg: number | null = null;
  let headingMismatch = false;
  if (
    typeof input.headingDeg === 'number' &&
    Number.isFinite(input.headingDeg)
  ) {
    headingDeltaDeg = signedBearingDelta(snap.bearingDeg, input.headingDeg);
    headingMismatch = Math.abs(headingDeltaDeg) > 90;
  }

  const remainingM = Math.max(0, snap.totalMeters - snap.progressMeters);
  const remainingKm = remainingM / 1000;

  /**
   * ETA 는 "현재 속도" 대신 안정화된 유효 속도로 계산.
   * - 순간 속도가 < 3km/h (정지/신호대기 포함) 면 자전거 기본 속도 15km/h 로 간주
   * - 순간 속도가 > 35km/h 로 튀면 35km/h 로 cap
   * - 속도 정보 자체가 없으면 15km/h fallback
   */
  const RAW = Number.isFinite(input.speedKmh) ? Number(input.speedKmh) : 0;
  const effectiveSpeedKmh = RAW >= 3 ? Math.min(RAW, 35) : 15;
  const estimatedDurationMin =
    remainingKm > 0 ? Math.round((remainingKm / effectiveSpeedKmh) * 60) : 0;
  const estimatedArrivalAt = new Date(
    Date.now() + estimatedDurationMin * 60_000,
  ).toISOString();

  const pois = await listPoisAlongCourse(
    input.courseId,
    'certification_center',
    50,
  );
  let nextPoi: ProgressResult['nextPoi'] = null;
  if (pois.length > 0) {
    const enriched = pois.map((p) => {
      const s = snapToPolyline({ lat: Number(p.lat), lng: Number(p.lng) }, poly);
      return { poi: p, progressM: s.progressMeters };
    });
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
    segmentIndex: snap.segmentIndex,
    routeBearingDeg: Number(snap.bearingDeg.toFixed(1)),
    progressKm: Number((snap.progressMeters / 1000).toFixed(3)),
    totalKm: Number((snap.totalMeters / 1000).toFixed(3)),
    remainingDistanceKm: Number(remainingKm.toFixed(3)),
    estimatedDurationMin,
    estimatedArrivalAt,
    offRoute,
    offRouteDistanceM: Math.round(snap.offRouteMeters),
    headingMismatch,
    headingDeltaDeg: headingDeltaDeg == null ? null : Number(headingDeltaDeg.toFixed(1)),
    nextPoi,
  };
}

