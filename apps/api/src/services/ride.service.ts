import { query, withTransaction } from '../db/pool';
import { notFound } from '../utils/http-error';

export interface StartRideInput {
  userId?: number | null;
  courseId?: number | null;
  segmentId?: number | null;
  deviceId?: string | null;
}

export interface TrackPointInput {
  lat: number;
  lng: number;
  speedKmh?: number;
  altitudeM?: number;
  recordedAt?: string; // ISO
}

export interface EndRideInput {
  totalDistanceKm?: number;
  avgSpeedKmh?: number;
  maxSpeedKmh?: number;
  movingTimeSec?: number;
  stoppedTimeSec?: number;
}

export interface RideSessionRow {
  id: number;
  user_id: number | null;
  course_id: number | null;
  segment_id: number | null;
  device_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  total_distance_km: string | null;
  avg_speed_kmh: string | null;
  max_speed_kmh: string | null;
  moving_time_sec: number | null;
  stopped_time_sec: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function startRide(input: StartRideInput): Promise<RideSessionRow> {
  const { rows } = await query<RideSessionRow>(
    `INSERT INTO ride_session (user_id, course_id, segment_id, device_id, started_at, status)
     VALUES ($1, $2, $3, $4, NOW(), 'IN_PROGRESS')
     RETURNING *`,
    [
      input.userId ?? null,
      input.courseId ?? null,
      input.segmentId ?? null,
      input.deviceId ?? null,
    ],
  );
  return rows[0];
}

export async function addTrackPoints(
  rideId: number,
  points: TrackPointInput[],
): Promise<{ inserted: number }> {
  if (points.length === 0) return { inserted: 0 };
  return withTransaction(async (client) => {
    // 세션 존재 확인
    const check = await client.query('SELECT id, status FROM ride_session WHERE id = $1', [rideId]);
    if (check.rowCount === 0) throw notFound('라이딩 세션을 찾을 수 없습니다.');

    let inserted = 0;
    for (const p of points) {
      const r = await client.query(
        `INSERT INTO ride_track_point (ride_session_id, lat, lng, speed_kmh, altitude_m, recorded_at)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))`,
        [rideId, p.lat, p.lng, p.speedKmh ?? null, p.altitudeM ?? null, p.recordedAt ?? null],
      );
      inserted += r.rowCount ?? 0;
    }
    return { inserted };
  });
}

export async function endRide(rideId: number, input: EndRideInput): Promise<RideSessionRow> {
  const { rows } = await query<RideSessionRow>(
    `UPDATE ride_session
        SET ended_at = NOW(),
            status = 'ENDED',
            total_distance_km = COALESCE($2, total_distance_km),
            avg_speed_kmh = COALESCE($3, avg_speed_kmh),
            max_speed_kmh = COALESCE($4, max_speed_kmh),
            moving_time_sec = COALESCE($5, moving_time_sec),
            stopped_time_sec = COALESCE($6, stopped_time_sec)
      WHERE id = $1
      RETURNING *`,
    [
      rideId,
      input.totalDistanceKm ?? null,
      input.avgSpeedKmh ?? null,
      input.maxSpeedKmh ?? null,
      input.movingTimeSec ?? null,
      input.stoppedTimeSec ?? null,
    ],
  );
  if (rows.length === 0) throw notFound('라이딩 세션을 찾을 수 없습니다.');
  return rows[0];
}

export interface RideListItem {
  id: number;
  courseId: number | null;
  courseName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  totalDistanceKm: number | null;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  movingTimeSec: number | null;
  stoppedTimeSec: number | null;
  status: string;
}

export interface ListRidesInput {
  deviceId?: string;
  userId?: number;
  limit?: number;
  offset?: number;
}

export async function listRides(input: ListRidesInput): Promise<RideListItem[]> {
  const params: unknown[] = [];
  const where: string[] = [];

  if (input.deviceId) {
    params.push(input.deviceId);
    where.push(`rs.device_id = $${params.length}`);
  }
  if (typeof input.userId === 'number') {
    params.push(input.userId);
    where.push(`rs.user_id = $${params.length}`);
  }

  // 최소 하나의 필터는 요구 (device_id 없이 전체 조회 방지)
  if (where.length === 0) return [];

  const whereSql = `WHERE ${where.join(' AND ')}`;

  params.push(input.limit ?? 30);
  const limitIdx = params.length;
  params.push(input.offset ?? 0);
  const offsetIdx = params.length;

  const { rows } = await query<{
    id: number;
    course_id: number | null;
    course_name: string | null;
    started_at: string | null;
    ended_at: string | null;
    total_distance_km: string | null;
    avg_speed_kmh: string | null;
    max_speed_kmh: string | null;
    moving_time_sec: number | null;
    stopped_time_sec: number | null;
    status: string;
  }>(
    `SELECT rs.id,
            rs.course_id,
            c.name AS course_name,
            rs.started_at,
            rs.ended_at,
            rs.total_distance_km,
            rs.avg_speed_kmh,
            rs.max_speed_kmh,
            rs.moving_time_sec,
            rs.stopped_time_sec,
            rs.status
       FROM ride_session rs
       LEFT JOIN course c ON c.id = rs.course_id
       ${whereSql}
      ORDER BY COALESCE(rs.started_at, rs.created_at) DESC NULLS LAST, rs.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params,
  );

  return rows.map((r) => ({
    id: Number(r.id),
    courseId: r.course_id == null ? null : Number(r.course_id),
    courseName: r.course_name,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    totalDistanceKm: r.total_distance_km == null ? null : Number(r.total_distance_km),
    avgSpeedKmh: r.avg_speed_kmh == null ? null : Number(r.avg_speed_kmh),
    maxSpeedKmh: r.max_speed_kmh == null ? null : Number(r.max_speed_kmh),
    movingTimeSec: r.moving_time_sec,
    stoppedTimeSec: r.stopped_time_sec,
    status: r.status,
  }));
}

export async function getRide(rideId: number): Promise<{
  session: RideSessionRow;
  trackPoints: Array<{
    lat: number;
    lng: number;
    speed_kmh: number | null;
    altitude_m: number | null;
    recorded_at: string;
  }>;
}> {
  const sessionQ = await query<RideSessionRow>(
    `SELECT * FROM ride_session WHERE id = $1`,
    [rideId],
  );
  if (sessionQ.rows.length === 0) throw notFound('라이딩 세션을 찾을 수 없습니다.');

  const pointsQ = await query<{
    lat: number;
    lng: number;
    speed_kmh: number | null;
    altitude_m: number | null;
    recorded_at: string;
  }>(
    `SELECT lat::float8 AS lat, lng::float8 AS lng,
            speed_kmh::float8 AS speed_kmh, altitude_m::float8 AS altitude_m,
            recorded_at
     FROM ride_track_point
     WHERE ride_session_id = $1
     ORDER BY recorded_at ASC`,
    [rideId],
  );

  return { session: sessionQ.rows[0], trackPoints: pointsQ.rows };
}
