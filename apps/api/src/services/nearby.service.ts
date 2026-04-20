import axios from 'axios';
import { query } from '../db/pool';
import { cacheGet, cacheSet } from '../db/redis';
import { env } from '../config/env';
import type { PoiRow } from './course.service';

export interface NearbyQuery {
  lat: number;
  lng: number;
  type?: string;
  radius?: number; // meters
  source?: 'db' | 'kakao' | 'auto';
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

const KAKAO_BASE = 'https://dapi.kakao.com';

const KAKAO_CATEGORY_MAP: Record<string, string> = {
  convenience_store: 'CS2',
  restaurant: 'FD6',
  cafe: 'CE7',
  lodging: 'AD5',
  parking: 'PK6',
};

export async function searchNearbyDb(q: NearbyQuery): Promise<NearbyItem[]> {
  const radius = q.radius ?? 2000;
  const params: unknown[] = [q.lng, q.lat, radius];
  let typeFilter = '';
  if (q.type) {
    params.push(q.type);
    typeFilter = `AND type = $${params.length}`;
  }

  const { rows } = await query<PoiRow & { distance_m: number }>(
    `SELECT id, course_id, segment_id, type, name, address,
            lat::float8 AS lat, lng::float8 AS lng, source, metadata,
            ST_Distance(
              geom,
              ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
            ) AS distance_m
     FROM poi
     WHERE ST_DWithin(
             geom,
             ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography,
             $3
           )
       ${typeFilter}
     ORDER BY distance_m ASC
     LIMIT 50`,
    params,
  );

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    address: r.address,
    lat: Number(r.lat),
    lng: Number(r.lng),
    distanceM: Math.round(Number(r.distance_m)),
    source: 'db',
    metadata: r.metadata ?? undefined,
  }));
}

export async function searchNearbyKakao(q: NearbyQuery): Promise<NearbyItem[]> {
  if (!env.kakao.restApiKey) return [];
  if (!q.type) return [];
  const code = KAKAO_CATEGORY_MAP[q.type];
  if (!code) return [];

  const cacheKey = `kakao:${code}:${q.lat.toFixed(4)}:${q.lng.toFixed(4)}:${q.radius ?? 2000}`;
  const cached = await cacheGet<NearbyItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.get(`${KAKAO_BASE}/v2/local/search/category.json`, {
      params: {
        category_group_code: code,
        x: q.lng,
        y: q.lat,
        radius: q.radius ?? 2000,
        sort: 'distance',
        size: 15,
      },
      headers: { Authorization: `KakaoAK ${env.kakao.restApiKey}` },
      timeout: 3000,
    });

    interface KakaoDocument {
      id: string;
      place_name: string;
      address_name: string;
      road_address_name?: string;
      x: string;
      y: string;
      distance?: string;
      phone?: string;
      category_name?: string;
    }
    const docs: KakaoDocument[] = res.data?.documents ?? [];
    const items: NearbyItem[] = docs.map((d) => ({
      id: `kakao:${d.id}`,
      type: q.type!,
      name: d.place_name,
      address: d.road_address_name || d.address_name || null,
      lat: Number(d.y),
      lng: Number(d.x),
      distanceM: d.distance ? Number(d.distance) : 0,
      source: 'kakao',
      metadata: { phone: d.phone, category: d.category_name },
    }));
    await cacheSet(cacheKey, items, 300);
    return items;
  } catch (e) {
    console.warn('[kakao] local api failed:', (e as Error).message);
    return [];
  }
}

/**
 * 전략:
 * - 인증센터/화장실/쉼터/자전거수리 → DB 우선
 * - 편의점/식당/카페/숙소 → Kakao 우선, 실패 시 DB
 * - source=auto (기본) 면 type 기반 자동 판단 + 혼합
 */
export async function searchNearby(q: NearbyQuery): Promise<NearbyItem[]> {
  const source = q.source ?? 'auto';

  const dbFirstTypes = new Set([
    'certification_center',
    'restroom',
    'water_station',
    'air_pump',
    'shelter',
    'bike_repair',
  ]);
  const kakaoFirstTypes = new Set([
    'convenience_store',
    'restaurant',
    'cafe',
    'lodging',
  ]);

  if (source === 'db') return searchNearbyDb(q);
  if (source === 'kakao') return searchNearbyKakao(q);

  if (q.type && kakaoFirstTypes.has(q.type)) {
    const [k, d] = await Promise.all([searchNearbyKakao(q), searchNearbyDb(q)]);
    return mergeByDistance([...k, ...d]);
  }
  if (q.type && dbFirstTypes.has(q.type)) {
    const d = await searchNearbyDb(q);
    if (d.length > 0) return d;
    return searchNearbyKakao(q);
  }
  // type 미지정: DB 전체에서 거리순
  return searchNearbyDb(q);
}

function mergeByDistance(items: NearbyItem[]): NearbyItem[] {
  const seen = new Set<string>();
  const out: NearbyItem[] = [];
  for (const it of items.sort((a, b) => a.distanceM - b.distanceM)) {
    const key = `${it.name}|${it.lat.toFixed(5)}|${it.lng.toFixed(5)}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}
