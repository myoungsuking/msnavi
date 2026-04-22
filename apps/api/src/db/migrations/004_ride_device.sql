-- =====================================================
-- 004: ride_session 에 device_id 컬럼 추가
-- - 로그인 체계가 없는 현재, 기기 단위로 "내 기록" 을 구분하기 위한 키.
-- - 이후 로그인이 붙으면 user_id 와 병행 사용 (device_id 는 익명 기록 보존용).
-- =====================================================

ALTER TABLE ride_session
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_ride_session_device
  ON ride_session(device_id, started_at DESC);

COMMENT ON COLUMN ride_session.device_id IS '익명 디바이스 식별자 (앱 설치 시 UUID 생성, AsyncStorage 에 보관).';
