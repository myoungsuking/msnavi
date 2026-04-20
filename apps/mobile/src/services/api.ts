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

export const navigationApi = {
  progress: async (body: {
    courseId: number;
    lat: number;
    lng: number;
    speedKmh?: number;
  }): Promise<ProgressResponse> => (await api.post('/navigation/progress', body)).data,
};

export const ridesApi = {
  start: async (body: { courseId?: number; segmentId?: number; userId?: number }) =>
    (await api.post('/rides/start', body)).data,
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
  get: async (id: number) => (await api.get(`/rides/${id}`)).data,
};
