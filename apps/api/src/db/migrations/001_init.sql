-- =====================================================
-- 국토종주 네비게이션 초기 스키마 (V1)
-- PostgreSQL 16 + PostGIS 3.x 가정
-- =====================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- course
-- =====================================================
CREATE TABLE IF NOT EXISTS course (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  total_distance_km NUMERIC(8,2),
  gpx_file_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- course_segment
-- =====================================================
CREATE TABLE IF NOT EXISTS course_segment (
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  seq INT NOT NULL,
  distance_km NUMERIC(8,2),
  geom GEOGRAPHY(LINESTRING, 4326),
  start_point_name VARCHAR(200),
  end_point_name VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_course_segment_course ON course_segment(course_id, seq);
CREATE INDEX IF NOT EXISTS idx_course_segment_geom ON course_segment USING GIST(geom);

-- =====================================================
-- poi
-- =====================================================
CREATE TABLE IF NOT EXISTS poi (
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT REFERENCES course(id) ON DELETE SET NULL,
  segment_id BIGINT REFERENCES course_segment(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  geom GEOGRAPHY(POINT, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)::geography) STORED,
  source VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_poi_type ON poi(type);
CREATE INDEX IF NOT EXISTS idx_poi_geom ON poi USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_poi_name_trgm ON poi USING GIN (name gin_trgm_ops);

-- =====================================================
-- ride_session
-- =====================================================
CREATE TABLE IF NOT EXISTS ride_session (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  course_id BIGINT REFERENCES course(id) ON DELETE SET NULL,
  segment_id BIGINT REFERENCES course_segment(id) ON DELETE SET NULL,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  total_distance_km NUMERIC(8,2),
  avg_speed_kmh NUMERIC(6,2),
  max_speed_kmh NUMERIC(6,2),
  moving_time_sec INT,
  stopped_time_sec INT,
  status VARCHAR(30) DEFAULT 'IN_PROGRESS',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ride_session_user ON ride_session(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ride_session_status ON ride_session(status);

-- =====================================================
-- ride_track_point
-- =====================================================
CREATE TABLE IF NOT EXISTS ride_track_point (
  id BIGSERIAL PRIMARY KEY,
  ride_session_id BIGINT NOT NULL REFERENCES ride_session(id) ON DELETE CASCADE,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  speed_kmh NUMERIC(6,2),
  altitude_m NUMERIC(8,2),
  recorded_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ride_track_session ON ride_track_point(ride_session_id, recorded_at);

-- =====================================================
-- updated_at 트리거
-- =====================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_course_updated') THEN
    CREATE TRIGGER trg_course_updated BEFORE UPDATE ON course
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_course_segment_updated') THEN
    CREATE TRIGGER trg_course_segment_updated BEFORE UPDATE ON course_segment
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_poi_updated') THEN
    CREATE TRIGGER trg_poi_updated BEFORE UPDATE ON poi
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ride_session_updated') THEN
    CREATE TRIGGER trg_ride_session_updated BEFORE UPDATE ON ride_session
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
