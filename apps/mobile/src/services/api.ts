import axios from 'axios';
import { appConfig } from '../config/appConfig';

export const api = axios.create({
  baseURL: `${appConfig.apiBaseUrl.replace(/\/$/, '')}/api`,
  timeout: 10_000,
});

export interface Course {
  id: number;
  name: string;
  description: string | null;
  total_distance_km: string | null;
  gpx_file_url: string | null;
}

export interface CourseSegment {
  id: number;
  course_id: number;
  name: string;
  seq: number;
  distance_km: string | null;
  start_point_name: string | null;
  end_point_name: string | null;
  coordinates: [number, number][];
}

export interface Poi {
  id: number;
  type: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
}

export interface NearbyItem {
  id?: number | string;
  type: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  distanceM: number;
  source: 'db' | 'kakao';
}

export interface ProgressResponse {
  snapped: { lat: number; lng: number };
  segmentIndex: number;
  routeBearingDeg: number;
  progressKm: number;
  totalKm: number;
  remainingDistanceKm: number;
  estimatedDurationMin: number | null;
  estimatedArrivalAt: string | null;
  offRoute: boolean;
  offRouteDistanceM: number;
  headingMismatch: boolean;
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

export const coursesApi = {
  list: async (): Promise<Course[]> => (await api.get('/courses')).data.items,
  detail: async (id: number): Promise<Course> => (await api.get(`/courses/${id}`)).data,
  segments: async (id: number): Promise<CourseSegment[]> =>
    (await api.get(`/courses/${id}/segments`)).data.items,
  pois: async (id: number, type?: string): Promise<Poi[]> =>
    (await api.get(`/courses/${id}/pois`, { params: { type } })).data.items,
};

export const nearbyApi = {
  search: async (params: {
    lat: number;
    lng: number;
    type?: string;
    radius?: number;
    source?: 'db' | 'kakao' | 'auto';
  }): Promise<NearbyItem[]> => (await api.get('/nearby', { params })).data.items,
};

/**
 * PostgreSQL bigint 가 node-pg 에서 문자열로 반환되기 때문에, 클라이언트 store 에
 * string 형태의 id 가 보관돼 있을 수 있다. 서버 zod 는 number 를 요구하므로 항상 숫자 변환.
 */
function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export const navigationApi = {
  progress: async (body: {
    courseId: number | string;
    lat: number;
    lng: number;
    speedKmh?: number;
    headingDeg?: number;
    lastSegmentIndex?: number;
  }): Promise<ProgressResponse> =>
    (
      await api.post('/navigation/progress', {
        ...body,
        courseId: toNum(body.courseId),
      })
    ).data,
};

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

export interface RideDetailResponse {
  session: {
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
  };
  trackPoints: Array<{
    lat: number;
    lng: number;
    speed_kmh: number | null;
    altitude_m: number | null;
    recorded_at: string;
  }>;
}

export const ridesApi = {
  start: async (body: {
    courseId?: number | string;
    segmentId?: number | string;
    userId?: number | string;
    deviceId?: string;
  }) =>
    (
      await api.post('/rides/start', {
        courseId: toNum(body.courseId),
        segmentId: toNum(body.segmentId),
        userId: toNum(body.userId),
        deviceId: body.deviceId,
      })
    ).data,
  track: async (
    id: number,
    points: Array<{
      lat: number;
      lng: number;
      speedKmh?: number;
      altitudeM?: number;
      recordedAt?: string;
    }>,
  ) => (await api.post(`/rides/${id}/track`, { points })).data,
  end: async (
    id: number,
    body: {
      totalDistanceKm?: number;
      avgSpeedKmh?: number;
      maxSpeedKmh?: number;
      movingTimeSec?: number;
      stoppedTimeSec?: number;
    },
  ) => (await api.post(`/rides/${id}/end`, body)).data,
  get: async (id: number): Promise<RideDetailResponse> =>
    (await api.get(`/rides/${id}`)).data,
  list: async (params: {
    deviceId?: string;
    userId?: number;
    limit?: number;
    offset?: number;
  }): Promise<RideListItem[]> =>
    (await api.get('/rides', { params })).data.items,
};
