import { query, withTransaction } from '../db/pool';
import { notFound } from '../utils/http-error';

export interface StartRideInput {
  userId?: number | null;
  courseId?: number | null;
  segmentId?: number | null;
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
    `INSERT INTO ride_session (user_id, course_id, segment_id, started_at, status)
     VALUES ($1, $2, $3, NOW(), 'IN_PROGRESS')
     RETURNING *`,
    [input.userId ?? null, input.courseId ?? null, input.segmentId ?? null],
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
