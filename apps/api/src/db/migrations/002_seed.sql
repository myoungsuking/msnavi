-- =====================================================
-- 샘플 시드 데이터 (개발용)
-- =====================================================

-- 중복 삽입 방지를 위해 간단 upsert 흉내
INSERT INTO course (id, name, description, total_distance_km, gpx_file_url)
VALUES
  (1, '국토종주 자전거길 (인천~부산)', '아라뱃길 ~ 한강 ~ 남한강 ~ 새재 ~ 낙동강, 총 633km', 633.00, NULL),
  (2, '한강 종주 자전거길 (아라~충주)', '아라자전거길 + 한강자전거길 + 남한강자전거길', 192.00, NULL)
ON CONFLICT (id) DO NOTHING;

-- 샘플 세그먼트 (서울 한강 일부)
INSERT INTO course_segment (id, course_id, name, seq, distance_km, geom, start_point_name, end_point_name)
VALUES
  (
    1, 1, '여의도 ~ 잠실', 1, 14.50,
    ST_GeogFromText('SRID=4326;LINESTRING(126.9166 37.5272, 126.9368 37.5186, 126.9784 37.5196, 127.0276 37.5211, 127.0820 37.5205)'),
    '여의도', '잠실'
  ),
  (
    2, 1, '잠실 ~ 팔당', 2, 22.30,
    ST_GeogFromText('SRID=4326;LINESTRING(127.0820 37.5205, 127.1220 37.5400, 127.1600 37.5500, 127.2300 37.5550, 127.3200 37.5380)'),
    '잠실', '팔당'
  )
ON CONFLICT (id) DO NOTHING;

-- 샘플 POI
INSERT INTO poi (id, course_id, segment_id, type, name, address, lat, lng, source)
VALUES
  (1, 1, 1, 'certification_center', '여의도 인증센터', '서울 영등포구 여의동', 37.5272, 126.9166, 'seed'),
  (2, 1, 1, 'certification_center', '잠실 인증센터', '서울 송파구 잠실동', 37.5205, 127.0820, 'seed'),
  (3, 1, 2, 'certification_center', '팔당 인증센터', '경기 남양주시 조안면', 37.5380, 127.3200, 'seed'),
  (4, 1, 1, 'restroom', '반포 공중화장실', '서울 서초구 반포동', 37.5105, 126.9968, 'seed'),
  (5, 1, 1, 'convenience_store', 'GS25 한강공원점', '서울 영등포구', 37.5272, 126.9330, 'seed'),
  (6, 1, 2, 'shelter', '미사 쉼터', '경기 하남시', 37.5500, 127.2000, 'seed')
ON CONFLICT (id) DO NOTHING;

-- 시퀀스 보정
SELECT setval(pg_get_serial_sequence('course', 'id'), COALESCE((SELECT MAX(id) FROM course), 1));
SELECT setval(pg_get_serial_sequence('course_segment', 'id'), COALESCE((SELECT MAX(id) FROM course_segment), 1));
SELECT setval(pg_get_serial_sequence('poi', 'id'), COALESCE((SELECT MAX(id) FROM poi), 1));
