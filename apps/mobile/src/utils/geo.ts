export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_R = 6371000; // meters
const toRad = (d: number) => (d * Math.PI) / 180;

/** 두 좌표 사이 직선 거리(m) - Haversine */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const la1 = toRad(a.latitude);
  const la2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 점 p 에서 선분 a-b 까지 최단 거리(m).
 * 좁은 영역에서는 위경도를 평면 근사해도 오차가 작아 충분히 정확.
 */
function distanceToSegment(p: LatLng, a: LatLng, b: LatLng): { d: number; t: number; proj: LatLng } {
  // 평면 근사: 1도 위도 ≈ 111_320m, 1도 경도 ≈ 111_320 * cos(lat) m
  const lat0 = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const kx = 111_320 * Math.cos(lat0);
  const ky = 110_540;

  const ax = 0;
  const ay = 0;
  const bx = (b.longitude - a.longitude) * kx;
  const by = (b.latitude - a.latitude) * ky;
  const px = (p.longitude - a.longitude) * kx;
  const py = (p.latitude - a.latitude) * ky;

  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const qx = ax + dx * t;
  const qy = ay + dy * t;
  const d = Math.sqrt((px - qx) ** 2 + (py - qy) ** 2);

  const proj: LatLng = {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
  return { d, t, proj };
}

export interface RouteNearest {
  /** 경로까지 최단 거리(m) */
  distanceM: number;
  /** 가장 가까운 선분의 시작 인덱스 (coords[i] ~ coords[i+1]) */
  segmentIndex: number;
  /** 경로 상 투영된 스냅 좌표 */
  projection: LatLng;
  /** 경로 시작점으로부터 투영 지점까지 누적 거리(m) */
  traveledM: number;
  /** 전체 경로 길이(m) */
  totalM: number;
}

/** 현재 위치에서 경로 polyline 까지 최단 거리 + 진행 정보 */
export function nearestOnRoute(p: LatLng, coords: LatLng[]): RouteNearest | null {
  if (!coords || coords.length < 2) return null;

  // 각 선분 누적 길이 미리 계산
  const cum: number[] = [0];
  for (let i = 0; i < coords.length - 1; i++) {
    cum.push(cum[i] + haversine(coords[i], coords[i + 1]));
  }
  const totalM = cum[cum.length - 1];

  let best = {
    d: Infinity,
    idx: 0,
    proj: coords[0],
    traveled: 0,
  };

  for (let i = 0; i < coords.length - 1; i++) {
    const { d, t, proj } = distanceToSegment(p, coords[i], coords[i + 1]);
    if (d < best.d) {
      const segLen = cum[i + 1] - cum[i];
      best = {
        d,
        idx: i,
        proj,
        traveled: cum[i] + segLen * t,
      };
    }
  }

  return {
    distanceM: best.d,
    segmentIndex: best.idx,
    projection: best.proj,
    traveledM: best.traveled,
    totalM,
  };
}

/** 현재 위치에서 가장 가까운 POI + 거리(m) */
export function nearestPoi<T extends LatLng>(
  p: LatLng,
  items: T[],
): { item: T; distanceM: number } | null {
  if (!items || items.length === 0) return null;
  let best: { item: T; distanceM: number } | null = null;
  for (const it of items) {
    const d = haversine(p, it);
    if (!best || d < best.distanceM) best = { item: it, distanceM: d };
  }
  return best;
}

/** m 를 사람이 읽기 쉬운 형태로 */
export function formatDistance(m: number): string {
  if (!Number.isFinite(m)) return '-';
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)}km`;
}

/** 초 단위 → "1시간 23분" / "45분" / "30초" */
export function formatDuration(sec?: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '-';
  if (sec < 60) return `${Math.round(sec)}초`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

/** ISO datetime → "2026.04.22 (수) 14:30" */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mi = `${d.getMinutes()}`.padStart(2, '0');
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${yyyy}.${mm}.${dd} (${weekday}) ${hh}:${mi}`;
}

// ──────────────────────────────────────────────────────────────────────────
// 턴바이턴: polyline vertex 기반 간이 턴 감지
// ──────────────────────────────────────────────────────────────────────────

/** 두 좌표 사이 초기 방위각(bearing, 0~360°, 북=0, 시계방향) */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/** 두 방위각의 부호있는 최소 차이 (-180..180). 양수=우회전, 음수=좌회전 */
export function signedBearingDelta(from: number, to: number): number {
  let d = ((to - from + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}

export type TurnDirection =
  | 'left'
  | 'right'
  | 'sharp-left'
  | 'sharp-right'
  | 'u-turn';

export interface TurnPoint {
  /** coords 상 꼭짓점 인덱스 */
  vertexIndex: number;
  /** 경로 시작점부터 이 꼭짓점까지 누적 거리(m) */
  cumM: number;
  /** 부호있는 회전각 (-180..180). 양수=우, 음수=좌 */
  angleDeg: number;
  direction: TurnDirection;
  location: LatLng;
}

export interface DetectTurnsOptions {
  /** 이 각도 이상이어야 턴으로 인정 (기본 35°) */
  minAngleDeg?: number;
  /** 꼭짓점 앞/뒤 다리 길이가 최소 이 값 이상이어야 함 (기본 20m) */
  minLegM?: number;
  /** sharp 기준 (기본 75°) */
  sharpAngleDeg?: number;
  /** u-turn 기준 (기본 150°) */
  uTurnAngleDeg?: number;
}

function classifyTurn(angle: number, sharp: number, uTurn: number): TurnDirection {
  const abs = Math.abs(angle);
  if (abs >= uTurn) return 'u-turn';
  if (abs >= sharp) return angle > 0 ? 'sharp-right' : 'sharp-left';
  return angle > 0 ? 'right' : 'left';
}

/**
 * polyline 꼭짓점들 중 "턴"으로 볼 만한 지점만 뽑는다.
 * - 입/출 레그 길이가 minLegM 이상일 때만 평가 (짧은 지그재그 노이즈 제거)
 * - 방위각 변화량이 minAngleDeg 이상이면 turn 으로 인정
 * - 인접한 턴이 minLegM 이내면 각도 절댓값이 큰 쪽만 유지
 */
export function detectTurns(
  coords: LatLng[],
  opts: DetectTurnsOptions = {},
): TurnPoint[] {
  const minAngle = opts.minAngleDeg ?? 35;
  const minLeg = opts.minLegM ?? 20;
  const sharp = opts.sharpAngleDeg ?? 75;
  const uTurn = opts.uTurnAngleDeg ?? 150;

  if (!coords || coords.length < 3) return [];

  const cum: number[] = [0];
  for (let i = 0; i < coords.length - 1; i++) {
    cum.push(cum[i] + haversine(coords[i], coords[i + 1]));
  }

  const raw: TurnPoint[] = [];
  for (let i = 1; i < coords.length - 1; i++) {
    const legIn = cum[i] - cum[i - 1];
    const legOut = cum[i + 1] - cum[i];
    if (legIn < minLeg || legOut < minLeg) continue;

    const bIn = bearingDeg(coords[i - 1], coords[i]);
    const bOut = bearingDeg(coords[i], coords[i + 1]);
    const d = signedBearingDelta(bIn, bOut);
    if (Math.abs(d) < minAngle) continue;

    raw.push({
      vertexIndex: i,
      cumM: cum[i],
      angleDeg: d,
      direction: classifyTurn(d, sharp, uTurn),
      location: coords[i],
    });
  }

  // 인접(minLeg 이내) 턴들 중 절댓값이 큰 것만 유지
  const merged: TurnPoint[] = [];
  for (const t of raw) {
    const last = merged[merged.length - 1];
    if (last && t.cumM - last.cumM < minLeg) {
      if (Math.abs(t.angleDeg) > Math.abs(last.angleDeg)) {
        merged[merged.length - 1] = t;
      }
      continue;
    }
    merged.push(t);
  }
  return merged;
}

/** 현재 traveledM 이후의 첫 턴 (없으면 null) */
export function nextTurnFrom(
  turns: TurnPoint[],
  traveledM: number,
  /** 이 거리(m) 이상 지난 턴은 무시 (기본 10m: 스냅 오차 보정) */
  passedToleranceM = 10,
): { turn: TurnPoint; distanceM: number } | null {
  if (!turns || turns.length === 0) return null;
  for (const t of turns) {
    const d = t.cumM - traveledM;
    if (d >= -passedToleranceM) {
      return { turn: t, distanceM: Math.max(0, d) };
    }
  }
  return null;
}

/** 턴 방향 → 한국어 라벨 */
export function turnLabelKo(dir: TurnDirection): string {
  switch (dir) {
    case 'left':
      return '좌회전';
    case 'right':
      return '우회전';
    case 'sharp-left':
      return '급좌회전';
    case 'sharp-right':
      return '급우회전';
    case 'u-turn':
      return '유턴';
  }
}

/** 턴 방향 → 화살표 글리프 (흑백 텍스트 톤 유지) */
export function turnArrow(dir: TurnDirection): string {
  switch (dir) {
    case 'left':
      return '←';
    case 'right':
      return '→';
    case 'sharp-left':
      return '↰';
    case 'sharp-right':
      return '↱';
    case 'u-turn':
      return '↶';
  }
}

// ──────────────────────────────────────────────────────────────────────────
// polyline smoothing (지도 표시용 — 계산용 경로에는 원본을 유지할 것)
// ──────────────────────────────────────────────────────────────────────────

export interface SmoothPathOptions {
  /** 이 거리(m) 이상인 선분만 보간. 기본 30m */
  maxSegmentM?: number;
  /** 안전 상한: 보간 예상 점 수가 이 값을 넘으면 원본 그대로 반환. 기본 50000 */
  maxOutput?: number;
  /** 한 선분(두 원 점 사이) 당 최대 보간 점 수. 기본 20 */
  maxSamplesPerSegment?: number;
}

function catmullRomPoint(
  p0: LatLng,
  p1: LatLng,
  p2: LatLng,
  p3: LatLng,
  t: number,
): LatLng {
  const t2 = t * t;
  const t3 = t2 * t;

  const lat =
    0.5 *
    (2 * p1.latitude +
      (-p0.latitude + p2.latitude) * t +
      (2 * p0.latitude - 5 * p1.latitude + 4 * p2.latitude - p3.latitude) * t2 +
      (-p0.latitude + 3 * p1.latitude - 3 * p2.latitude + p3.latitude) * t3);

  const lng =
    0.5 *
    (2 * p1.longitude +
      (-p0.longitude + p2.longitude) * t +
      (2 * p0.longitude - 5 * p1.longitude + 4 * p2.longitude - p3.longitude) * t2 +
      (-p0.longitude + 3 * p1.longitude - 3 * p2.longitude + p3.longitude) * t3);

  return { latitude: lat, longitude: lng };
}

/**
 * polyline 내에서 인접 점 사이 거리가 maxJumpM 을 초과하는 지점을 경계로
 * 여러 조각으로 분할한다.
 *
 * 배경: 행정안전부 공공데이터 CSV 의 일부 노선(예: road_sn=2 한강종주)은
 * 본선과 여러 지선이 하나의 레코드 안에 섞여 있고, seq 순서대로 LINESTRING
 * 으로 이어붙이면 "본선 끝 → 지선 시작" 사이에 수 km ~ 수십 km 의 큰 점프가
 * 생겨 지도상 굵은 직선 막대로 보인다. 이 함수로 조각을 분리해 각 조각을
 * 독립 polyline 으로 그리면 점프 선분이 시각적으로 사라진다.
 *
 * 계산용(턴 감지/진행률/서버 progress) 에는 이 분할을 쓰지 말고
 * 원본 배열을 그대로 써야 한다 (조각 경계를 이동했다고 가정할 수 없음).
 */
export function splitOnJumps(
  coords: LatLng[],
  maxJumpM = 500,
): LatLng[][] {
  if (!coords || coords.length === 0) return [];
  const out: LatLng[][] = [];
  let current: LatLng[] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const d = haversine(coords[i - 1], coords[i]);
    if (d > maxJumpM) {
      if (current.length >= 2) out.push(current);
      current = [coords[i]];
    } else {
      current.push(coords[i]);
    }
  }
  if (current.length >= 2) out.push(current);
  return out;
}

/** polyline 길이(미터) 합. */
export function pathLengthM(coords: LatLng[]): number {
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1], coords[i]);
  return total;
}

/**
 * sparse polyline 을 Catmull-Rom 스플라인으로 부드럽게 보간한다.
 *
 * - 원본 점은 모두 그대로 통과 (Catmull-Rom 특성)
 * - 인접 점 간 거리가 maxSegmentM 이하면 그대로 두고, 초과 구간만 중간점 삽입
 * - 예상 출력 점 수가 maxOutput 을 초과하면 원본을 그대로 반환 (성능 가드)
 *
 * 용도: 행정안전부 공공데이터 코스가 8~수십 점 수준으로 sparse 한 경우
 *       (예: road_sn=45, 46) 지도상 폴리라인이 꺾인 직선 조각처럼 보이는
 *       현상을 시각적으로 완화. 서버 진행률/턴 감지/맵매칭 등 계산용 경로에는
 *       **사용하지 말고 원본을 유지할 것**.
 */
export function smoothPath(
  coords: LatLng[],
  opts: SmoothPathOptions = {},
): LatLng[] {
  const maxSeg = opts.maxSegmentM ?? 30;
  const maxOut = opts.maxOutput ?? 50_000;
  const maxSamples = opts.maxSamplesPerSegment ?? 20;

  const n = coords?.length ?? 0;
  if (n < 4) return coords ?? [];

  let estimated = n;
  for (let i = 0; i < n - 1; i++) {
    const d = haversine(coords[i], coords[i + 1]);
    if (d > maxSeg) {
      const samples = Math.min(
        maxSamples,
        Math.max(0, Math.ceil(d / maxSeg) - 1),
      );
      estimated += samples;
    }
  }
  if (estimated === n) return coords;
  if (estimated > maxOut) return coords;

  const out: LatLng[] = [coords[0]];
  for (let i = 0; i < n - 1; i++) {
    const p0 = i === 0 ? coords[0] : coords[i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = i + 2 < n ? coords[i + 2] : coords[n - 1];

    const d = haversine(p1, p2);
    if (d > maxSeg) {
      const samples = Math.min(
        maxSamples,
        Math.max(0, Math.ceil(d / maxSeg) - 1),
      );
      for (let s = 1; s <= samples; s++) {
        const t = s / (samples + 1);
        out.push(catmullRomPoint(p0, p1, p2, p3, t));
      }
    }
    out.push(p2);
  }
  return out;
}
