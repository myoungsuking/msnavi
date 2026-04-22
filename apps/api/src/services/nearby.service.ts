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

/**
 * Kakao 로컬 카테고리 코드 매핑.
 * 편의점/식당/카페/숙소/주차장 처럼 카카오가 공식 카테고리로 관리하는 것만 사용.
 * https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-category
 */
const KAKAO_CATEGORY_MAP: Record<string, string> = {
  convenience_store: 'CS2',
  restaurant: 'FD6',
  cafe: 'CE7',
  lodging: 'AD5',
  parking: 'PK6',
};

/**
 * 카카오가 카테고리로 제공하지 않는 자전거 친화 POI 는 **키워드 검색** 으로 찾는다.
 * - 사전 DB(행정안전부 자전거길 POI) 는 "자전거길 위" 좌표라 사용자가 도심 집에서
 *   테스트하면 반경 2km 에 잡히는 게 없을 수 있음.
 * - 카카오 키워드 검색은 일반 도심 시설까지 포괄하므로 반경 내에 뭐라도 나오게 된다.
 * 값은 "여러 키워드 배열" - 가능한 한 리콜을 올리기 위해 유사 키워드를 함께 시도.
 */
const KAKAO_KEYWORD_MAP: Record<string, string[]> = {
  restroom: ['공중화장실', '화장실'],
  water_station: ['급수대', '음수대'],
  air_pump: ['자전거 공기주입기', '공기주입기', '자전거 바람', '자전거펌프'],
  bike_repair: ['자전거 수리', '자전거 수리점', '자전거점', '자전거 판매', '자전거대여'],
  shelter: ['쉼터', '자전거 쉼터'],
  // 인증센터는 DB 가 정답지만, DB 가 비어있을 때만 fallback.
  certification_center: ['국토종주 인증센터', '자전거길 인증센터'],
};

/**
 * DB 가 우선이고, DB 결과가 비었을 때만 카카오 fallback 하는 타입.
 * 인증센터: DB 레코드가 공식/정답. 카카오는 일반 검색어라 유사점 많이 딸려옴.
 */
const DB_AUTHORITATIVE_TYPES = new Set(['certification_center']);

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

function toItem(d: KakaoDocument, type: string, extraMeta?: Record<string, unknown>): NearbyItem {
  return {
    id: `kakao:${d.id}`,
    type,
    name: d.place_name,
    address: d.road_address_name || d.address_name || null,
    lat: Number(d.y),
    lng: Number(d.x),
    distanceM: d.distance ? Number(d.distance) : 0,
    source: 'kakao',
    metadata: { phone: d.phone, category: d.category_name, ...extraMeta },
  };
}

/** 카카오 카테고리 코드 기반 검색 (편의점/식당/카페/숙소/주차장 등) */
export async function searchNearbyKakao(q: NearbyQuery): Promise<NearbyItem[]> {
  if (!env.kakao.restApiKey) return [];
  if (!q.type) return [];
  const code = KAKAO_CATEGORY_MAP[q.type];
  if (!code) return [];

  const cacheKey = `kakao:cat:${code}:${q.lat.toFixed(4)}:${q.lng.toFixed(4)}:${q.radius ?? 2000}`;
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

    const docs: KakaoDocument[] = res.data?.documents ?? [];
    const items = docs.map((d) => toItem(d, q.type!));
    await cacheSet(cacheKey, items, 300);
    return items;
  } catch (e) {
    console.warn('[kakao] category api failed:', (e as Error).message);
    return [];
  }
}

/**
 * 카카오 키워드 검색. 여러 키워드를 순차 시도 후 결과 합집합 반환.
 * (카테고리 코드가 없는 타입 - 화장실/급수대/공기주입기/자전거수리 등 용)
 */
export async function searchNearbyKakaoKeyword(
  q: NearbyQuery,
  keywords: string[],
): Promise<NearbyItem[]> {
  if (!env.kakao.restApiKey) return [];
  if (!q.type || keywords.length === 0) return [];

  const cacheKey = `kakao:kw:${q.type}:${q.lat.toFixed(4)}:${q.lng.toFixed(4)}:${q.radius ?? 2000}`;
  const cached = await cacheGet<NearbyItem[]>(cacheKey);
  if (cached) return cached;

  const collected: NearbyItem[] = [];
  for (const kw of keywords) {
    try {
      const res = await axios.get(`${KAKAO_BASE}/v2/local/search/keyword.json`, {
        params: {
          query: kw,
          x: q.lng,
          y: q.lat,
          radius: q.radius ?? 2000,
          sort: 'distance',
          size: 15,
        },
        headers: { Authorization: `KakaoAK ${env.kakao.restApiKey}` },
        timeout: 3000,
      });
      const docs: KakaoDocument[] = res.data?.documents ?? [];
      for (const d of docs) {
        collected.push(toItem(d, q.type, { matchedKeyword: kw }));
      }
    } catch (e) {
      console.warn(`[kakao] keyword "${kw}" failed:`, (e as Error).message);
    }
  }

  // id 기준 중복 제거 (같은 장소가 다른 키워드에서 중복 매치될 수 있음)
  const seen = new Set<string>();
  const deduped: NearbyItem[] = [];
  for (const it of collected.sort((a, b) => a.distanceM - b.distanceM)) {
    const k = String(it.id ?? `${it.name}|${it.lat.toFixed(5)}|${it.lng.toFixed(5)}`);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(it);
  }

  await cacheSet(cacheKey, deduped, 300);
  return deduped;
}

/** 타입에 맞는 카카오 전략을 자동 선택 (카테고리 있으면 카테고리, 없으면 키워드) */
async function searchKakaoAuto(q: NearbyQuery): Promise<NearbyItem[]> {
  if (!q.type) return [];
  if (KAKAO_CATEGORY_MAP[q.type]) return searchNearbyKakao(q);
  const kws = KAKAO_KEYWORD_MAP[q.type];
  if (kws && kws.length > 0) return searchNearbyKakaoKeyword(q, kws);
  return [];
}

/**
 * 전략 (source=auto, 기본):
 *  - 인증센터: DB 우선. DB 가 비면 카카오 키워드 fallback.
 *  - 나머지(화장실/급수대/공기주입기/자전거수리/편의점/식당/카페/숙소 ...):
 *      DB + 카카오(카테고리 or 키워드) 병렬 조회 후 거리순 머지.
 *  - 사용자가 자전거길 위가 아닌 도심 집에서 주변 탭을 열어도 도심 일반 시설까지
 *    같이 잡히도록 한다.
 *
 * source='db' / 'kakao' 은 명시적 강제 경로.
 */
export async function searchNearby(q: NearbyQuery): Promise<NearbyItem[]> {
  const source = q.source ?? 'auto';

  if (source === 'db') return searchNearbyDb(q);
  if (source === 'kakao') return searchKakaoAuto(q);

  // type 미지정 → DB 전체에서 거리순
  if (!q.type) return searchNearbyDb(q);

  // DB 우선 (인증센터 등): 있으면 DB만, 없으면 카카오 fallback
  if (DB_AUTHORITATIVE_TYPES.has(q.type)) {
    const dbItems = await searchNearbyDb(q);
    if (dbItems.length > 0) return dbItems;
    return searchKakaoAuto(q);
  }

  // 나머지: DB + 카카오 병렬 → 거리순 머지
  const [dbItems, kakaoItems] = await Promise.all([
    searchNearbyDb(q),
    searchKakaoAuto(q),
  ]);
  return mergeByDistance([...dbItems, ...kakaoItems]);
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
