export interface LatLng {
  lat: number;
  lng: number;
}

export interface Course {
  id: number;
  name: string;
  description: string | null;
  total_distance_km: string | null;
  gpx_file_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseSegment {
  id: number;
  course_id: number;
  name: string;
  seq: number;
  distance_km: string | null;
  start_point_name: string | null;
  end_point_name: string | null;
  /** [lng, lat] 쌍 배열 */
  coordinates: [number, number][];
}

export type PoiType =
  | 'certification_center'
  | 'convenience_store'
  | 'restroom'
  | 'restaurant'
  | 'lodging'
  | 'cafe'
  | 'bike_repair'
  | 'shelter';

export interface Poi {
  id: number;
  course_id: number | null;
  segment_id: number | null;
  type: PoiType | string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  source: string | null;
  metadata: Record<string, unknown> | null;
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
  metadata?: Record<string, unknown>;
}

export interface ProgressResponse {
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

export interface RideSession {
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
}
