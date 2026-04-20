-- =====================================================
-- 003: 공식 데이터(행정안전부 자전거길) 지원 확장
-- - course 에 road_sn(공식 노선코드) 유니크 컬럼 추가
-- - POI type 목록: water_station, air_pump 추가 (문서상 변경)
-- =====================================================

ALTER TABLE course
  ADD COLUMN IF NOT EXISTS road_sn INT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_course_road_sn ON course(road_sn)
  WHERE road_sn IS NOT NULL;

-- POI upsert 용 유니크 키(동일 type+name+좌표 중복 방지)
-- 소수점 4자리(약 11m)까지 잘라 중복 간주
CREATE UNIQUE INDEX IF NOT EXISTS uq_poi_identity
  ON poi(
    type,
    name,
    ROUND(lat::numeric, 4),
    ROUND(lng::numeric, 4)
  );

COMMENT ON COLUMN course.road_sn IS '행정안전부 ROAD_SN (1~46). 미사용/내부 코스는 NULL.';
