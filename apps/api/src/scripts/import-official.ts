/**
 * 행정안전부 국토종주 자전거길 공식 자료 적재 스크립트.
 *
 * 입력:
 *  - data/raw/gukto_routes.csv     (CP949, 노선 좌표 시퀀스)
 *  - data/raw/gukto_pois.csv       (CP949, 주변시설)
 *
 * 적재 대상:
 *  - course (road_sn 기준 upsert)
 *  - course_segment (노선별 1개 LINESTRING, seq=1)
 *  - poi (인증센터/화장실/급수대/공기주입기)
 *
 * 실행:
 *   npm run import:official
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { pool, withTransaction } from '../db/pool';

// 코드북 (route_codebook.xlsx 내용 임베드 - 46개 중 "사용하지 않음" 4개 제외)
const ROUTE_CODEBOOK: Record<number, string> = {
  1: '아라자전거길',
  2: '한강종주자전거길',
  3: '남한강자전거길',
  4: '새재자전거길',
  5: '낙동강자전거길',
  6: '금강자전거길',
  7: '영산강자전거길',
  8: '북한강자전거길',
  9: '섬진강자전거길',
  10: '오천자전거길',
  11: '동해안(강원)자전거길',
  12: '동해안(경북)자전거길',
  13: '제주환상자전거길',
  14: '강릉 경포호 산소길',
  15: '화천 파로호 100리 산소길',
  16: '옹진 덕적도 자전거길',
  17: '파주 DMZ 자전거길',
  18: '옥천 향수 100리길',
  19: '정읍 정읍천 자전거길',
  20: '신안 증도 자전거섬',
  21: '경주 역사탐방 자전거길',
  23: '제주 해맞이 해안로',
  24: '강화군(지붕없는 박물관) 자전거길',
  25: '옹진의 아름다운 시시모도 자전거 여행길',
  26: '군산 고군산도 자전거길',
  27: '여수 금오도 해안도로 자전거길',
  28: '고흥군(거금도~소록도) 자전거길',
  29: '완도 수목원 자전거길',
  30: '느림의 미학 완도군 청산도 자전거길',
  31: '항상 새로운 섬 완도군 생일도 자전거길',
  32: '쉬미향~청용삼거리 자전거길(진도군)',
  33: '신안군(입해도) 자전거길',
  34: '신안군(증도) 자전거길',
  35: '신안군(임자도) 자전거길',
  36: '신안군(자은, 임태도) 자전거길',
  39: '신안군(흑산도) 자전거길',
  41: '울릉도 꿈이 있는 자전거길',
  42: '환상의 사천시 신수도 바다 자전거길',
  43: '경남 남해(남해대교~남해읍 선소) 자전거길',
  44: '제주도(구좌읍 해맞이 해안로) 자전거길',
  45: '제주 환상 자전거길(오조리~성산리)',
  46: '제주도(상모리~사계리) 자전거길',
};

const POI_TYPE_MAP: Record<string, string> = {
  인증센터: 'certification_center',
  화장실: 'restroom',
  급수대: 'water_station',
  공기주입기: 'air_pump',
};

const DATA_DIR = path.resolve(__dirname, '../../../../data/raw');

type CsvRow = Record<string, string>;

function readCp949Csv(filename: string): CsvRow[] {
  const filePath = path.join(DATA_DIR, filename);
  const buf = fs.readFileSync(filePath);
  const text = iconv.decode(buf, 'cp949');
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as CsvRow[];
}

async function importRoutes() {
  console.log('[import] 노선좌표 읽는 중...');
  const rows = readCp949Csv('gukto_routes.csv');
  console.log(`[import] ${rows.length} points loaded`);

  // road_sn 별로 묶기 (순서 정렬)
  const byRoad = new Map<number, Array<{ seq: number; lat: number; lng: number }>>();
  for (const row of rows) {
    const roadSn = Number(row['국토종주 자전거길']);
    const seq = Number(row['순서']);
    const lat = Number(row['위도(LINE_XP)']);
    const lng = Number(row['경도(LINE_YP)']);
    if (!Number.isFinite(roadSn) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!byRoad.has(roadSn)) byRoad.set(roadSn, []);
    byRoad.get(roadSn)!.push({ seq, lat, lng });
  }

  for (const pts of byRoad.values()) {
    pts.sort((a, b) => a.seq - b.seq);
  }

  await withTransaction(async (client) => {
    for (const [roadSn, pts] of [...byRoad.entries()].sort((a, b) => a[0] - b[0])) {
      const name = ROUTE_CODEBOOK[roadSn] ?? `노선 ${roadSn}`;

      // 1) course upsert
      const courseRes = await client.query<{ id: number }>(
        `INSERT INTO course (road_sn, name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (road_sn) WHERE road_sn IS NOT NULL
         DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
         RETURNING id`,
        [roadSn, name, `행정안전부 공식 노선 (ROAD_SN=${roadSn})`],
      );
      const courseId = courseRes.rows[0].id;

      // 2) WKT LINESTRING 생성
      if (pts.length < 2) {
        console.log(`  road_sn=${roadSn} ${name}  (points=${pts.length}, skip segment)`);
        continue;
      }
      const wkt = `SRID=4326;LINESTRING(${pts
        .map((p) => `${p.lng} ${p.lat}`)
        .join(',')})`;

      // 3) 해당 course 의 segment 싹 지우고 재적재 (seq=1, 전체 노선 1개 LINESTRING)
      await client.query(`DELETE FROM course_segment WHERE course_id = $1`, [courseId]);
      const segRes = await client.query<{ id: number; distance_km: number }>(
        `INSERT INTO course_segment (course_id, name, seq, geom, distance_km)
         VALUES ($1, $2, 1, ST_GeogFromText($3), ST_Length(ST_GeogFromText($3)) / 1000.0)
         RETURNING id, distance_km::float8 AS distance_km`,
        [courseId, name, wkt],
      );
      const distKm = segRes.rows[0].distance_km;

      await client.query(
        `UPDATE course SET total_distance_km = $2 WHERE id = $1`,
        [courseId, distKm],
      );

      console.log(
        `  road_sn=${roadSn.toString().padStart(2)}  ${name}  points=${pts.length}  ${distKm.toFixed(2)}km`,
      );
    }
  });

  console.log(`[import] 노선 ${byRoad.size}개 적재 완료`);
}

async function importPois() {
  console.log('[import] 주변시설 읽는 중...');
  const rows = readCp949Csv('gukto_pois.csv');
  console.log(`[import] ${rows.length} POIs loaded`);

  let ok = 0;
  let skipped = 0;
  await withTransaction(async (client) => {
    for (const r of rows) {
      const type = POI_TYPE_MAP[r['구분']];
      if (!type) {
        skipped++;
        continue;
      }
      const lat = Number(r['위도']);
      const lng = Number(r['경도']);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        skipped++;
        continue;
      }
      const rawName = (r['이름'] ?? '').trim();
      // 인증센터는 실제 명칭이 이름에 들어가고, 나머지는 노선명만 기입되어 있음.
      const name =
        type === 'certification_center'
          ? rawName || '인증센터'
          : `${typeLabel(type)} (${rawName || '미상'})`;

      await client.query(
        `INSERT INTO poi (type, name, lat, lng, source, metadata)
         VALUES ($1, $2, $3, $4, 'mois_official', $5::jsonb)
         ON CONFLICT (type, name, ROUND(lat::numeric, 4), ROUND(lng::numeric, 4))
         DO UPDATE SET
           lat = EXCLUDED.lat,
           lng = EXCLUDED.lng,
           metadata = EXCLUDED.metadata`,
        [type, name, lat, lng, JSON.stringify({ routeName: rawName, raw구분: r['구분'] })],
      );
      ok++;
    }
  });
  console.log(`[import] POI 적재 완료: ok=${ok}, skipped=${skipped}`);
}

function typeLabel(type: string): string {
  switch (type) {
    case 'restroom':
      return '화장실';
    case 'water_station':
      return '급수대';
    case 'air_pump':
      return '공기주입기';
    case 'certification_center':
      return '인증센터';
    default:
      return type;
  }
}

async function main() {
  const started = Date.now();
  try {
    await importRoutes();
    await importPois();
    console.log(`[import] 전체 완료 (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('[import] failed', e);
  process.exit(1);
});
