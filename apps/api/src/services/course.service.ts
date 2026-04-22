import { query } from '../db/pool';
import { cacheGet, cacheSet } from '../db/redis';
import { notFound } from '../utils/http-error';

export interface CourseRow {
  id: number;
  name: string;
  description: string | null;
  total_distance_km: string | null;
  gpx_file_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseSegmentRow {
  id: number;
  course_id: number;
  name: string;
  seq: number;
  distance_km: string | null;
  start_point_name: string | null;
  end_point_name: string | null;
  coordinates: [number, number][]; // [lng, lat]
}

export interface PoiRow {
  id: number;
  course_id: number | null;
  segment_id: number | null;
  type: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  source: string | null;
  metadata: Record<string, unknown> | null;
}

export async function listCourses(): Promise<CourseRow[]> {
  const cacheKey = 'courses:list';
  const cached = await cacheGet<CourseRow[]>(cacheKey);
  if (cached) return cached;

  const { rows } = await query<CourseRow>(
    `SELECT id, name, description, total_distance_km, gpx_file_url, created_at, updated_at
     FROM course
     ORDER BY id ASC`,
  );
  await cacheSet(cacheKey, rows, 60);
  return rows;
}

export async function getCourse(id: number): Promise<CourseRow> {
  const { rows } = await query<CourseRow>(
    `SELECT id, name, description, total_distance_km, gpx_file_url, created_at, updated_at
     FROM course
     WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) throw notFound('코스를 찾을 수 없습니다.');
  return rows[0];
}

export async function listCourseSegments(courseId: number): Promise<CourseSegmentRow[]> {
  const cacheKey = `courses:${courseId}:segments`;
  const cached = await cacheGet<CourseSegmentRow[]>(cacheKey);
  if (cached) return cached;

  const { rows } = await query<CourseSegmentRow>(
    `SELECT
        id, course_id, name, seq, distance_km,
        start_point_name, end_point_name,
        ST_AsGeoJSON(geom)::jsonb -> 'coordinates' AS coordinates
     FROM course_segment
     WHERE course_id = $1
     ORDER BY seq ASC`,
    [courseId],
  );
  await cacheSet(cacheKey, rows, 300);
  return rows;
}

export async function listCoursePois(
  courseId: number,
  type?: string,
): Promise<PoiRow[]> {
  const params: unknown[] = [courseId];
  let where = 'WHERE course_id = $1';
  if (type) {
    params.push(type);
    where += ` AND type = $${params.length}`;
  }
  const { rows } = await query<PoiRow>(
    `SELECT id, course_id, segment_id, type, name, address,
            lat::float8 AS lat, lng::float8 AS lng, source, metadata
     FROM poi
     ${where}
     ORDER BY id ASC`,
    params,
  );
  return rows;
}

/**
 * 코스 polyline 근처(기본 50m 이내) 에 있는 POI 를 반환.
 *
 * `listCoursePois` 는 `poi.course_id = $1` 필터를 쓰는데, 경계에 있는 POI
 * (예: 아라 ↔ 한강 사이의 "아라한강갑문인증센터") 는 하나의 course_id 에만
 * 연결되므로 나머지 코스에서 보이지 않는 문제가 있었음.
 * 이 함수는 공간 쿼리로 "이 코스 선 위 30~50m 이내" 인 POI 를 전부 잡아서
 * 경계 POI 도 양쪽 코스 모두에 노출되게 한다.
 */
export async function listPoisAlongCourse(
  courseId: number,
  type?: string,
  toleranceM = 50,
): Promise<PoiRow[]> {
  const params: unknown[] = [courseId, toleranceM];
  let typeCond = '';
  if (type) {
    params.push(type);
    typeCond = ` AND p.type = $${params.length}`;
  }
  const { rows } = await query<PoiRow>(
    `SELECT DISTINCT ON (p.id)
            p.id, p.course_id, p.segment_id, p.type, p.name, p.address,
            p.lat::float8 AS lat, p.lng::float8 AS lng, p.source, p.metadata
       FROM poi p
       JOIN course_segment cs ON cs.course_id = $1
      WHERE ST_DWithin(
              cs.geom,
              ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
              $2
            )
        ${typeCond}
      ORDER BY p.id ASC`,
    params,
  );
  return rows;
}

/**
 * 코스 전체 polyline 을 seq 순서대로 이어붙인다.
 * [lng, lat] → { lat, lng } 로 정규화.
 */
export async function getCoursePolyline(
  courseId: number,
): Promise<{ lat: number; lng: number }[]> {
  const cacheKey = `courses:${courseId}:polyline`;
  const cached = await cacheGet<{ lat: number; lng: number }[]>(cacheKey);
  if (cached) return cached;

  const segments = await listCourseSegments(courseId);
  const poly: { lat: number; lng: number }[] = [];
  for (const seg of segments) {
    for (const coord of seg.coordinates ?? []) {
      const lng = Number(coord[0]);
      const lat = Number(coord[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        poly.push({ lat, lng });
      }
    }
  }
  await cacheSet(cacheKey, poly, 600);
  return poly;
}
