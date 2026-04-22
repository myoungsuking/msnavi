/**
 * 방위각(heading) 합성/스무딩 유틸.
 *
 * - GPS 기반 heading 은 저속/정지에서 노이즈가 크고, 일부 단말에서는 -1 등 invalid 값을 준다.
 * - 기기 나침반(magnetometer) heading 은 전 구간에서 값을 주지만 자석 간섭에 민감하다.
 * - 두 소스를 속도에 따라 가중 합성하면, 정지·주행 양쪽에서 안정적인 표시가 된다.
 */

/** heading 값이 유효한지 (0~360 범위 && NaN 아님) */
export function isValidHeading(h: number | null | undefined): h is number {
  return (
    typeof h === 'number' && Number.isFinite(h) && h >= 0 && h <= 360
  );
}

/** 두 각도의 부호있는 최소 차이 (-180..180). 양수=시계방향 회전 */
export function signedDeltaDeg(from: number, to: number): number {
  let d = ((to - from + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}

/** 0..360 으로 정규화 */
export function normalizeDeg(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/**
 * 각도 EMA (지수이동평균). wrap-around 안전을 위해 shortest-arc 경유.
 * alpha ∈ (0,1], 높을수록 최근 값에 더 가중.
 */
export function smoothHeading(prev: number | null, next: number, alpha = 0.25): number {
  if (prev == null || !isValidHeading(prev)) return normalizeDeg(next);
  const d = signedDeltaDeg(prev, next);
  return normalizeDeg(prev + d * alpha);
}

export interface HeadingSources {
  gpsHeading: number | null | undefined;
  gpsSpeedKmh: number | null | undefined;
  compassHeading: number | null | undefined;
}

/**
 * 속도에 따른 GPS/나침반 heading 합성.
 *
 * - 저속(<2km/h): 거의 나침반만 사용 (GPS heading 신뢰 불가)
 * - 고속(>8km/h): 거의 GPS heading 만 사용 (나침반은 핸드폰 방향일 뿐 진행방향과 다름)
 * - 중간 구간: 선형 blend
 *
 * 반환: 0~360 또는 null (두 소스 모두 유효하지 않을 때)
 */
export function fuseHeading({ gpsHeading, gpsSpeedKmh, compassHeading }: HeadingSources): number | null {
  const gpsOk = isValidHeading(gpsHeading);
  const compassOk = isValidHeading(compassHeading);

  if (!gpsOk && !compassOk) return null;
  if (!gpsOk) return normalizeDeg(compassHeading as number);
  if (!compassOk) return normalizeDeg(gpsHeading as number);

  const speed = Number.isFinite(gpsSpeedKmh ?? NaN) ? Math.max(0, gpsSpeedKmh as number) : 0;
  // 선형 가중치: 2km/h 에서 0, 8km/h 에서 1
  const tRaw = (speed - 2) / (8 - 2);
  const wGps = Math.max(0, Math.min(1, tRaw));
  const wCompass = 1 - wGps;

  // 각도 평균: shortest-arc 기준으로 compass→gps 쪽으로 wGps 만큼 이동
  const delta = signedDeltaDeg(compassHeading as number, gpsHeading as number);
  return normalizeDeg((compassHeading as number) + delta * wGps);
  // 참고: wGps=1 이면 gps, wGps=0 이면 compass 로 정확히 일치.
  void wCompass; // 가독성용 보존 (minifier 제거)
}
