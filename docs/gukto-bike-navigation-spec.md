# 국토종주 전용 네비게이션 모바일 애플리케이션 설계서

## 1. 목적
국토종주 자전거 이용자를 대상으로, **현재 위치 기반 주행 안내**, **남은 거리/예상 도착 시간 계산**, **주변 편의시설 탐색**, **인증센터 및 주요 거점 표시**를 제공하는 모바일 애플리케이션을 구축한다.

---

## 2. 핵심 요구사항

### 필수 기능
- 출발지 / 도착지 / 구간 선택
- 현재 위치 표시
- 현재 속도 표시
- 남은 거리 표시
- 예상 도착 시각(ETA) 표시
- 예상 소요 시간 표시
- 경로 이탈 감지
- 주변 편의점 / 화장실 / 식당 / 숙소 조회
- 인증센터 위치 조회
- 배터리 절약형 GPS 추적
- 오프라인 환경 일부 대응

### 있으면 좋은 기능
- 구간별 고도 정보
- 휴식 추천 포인트
- 주행 기록 저장
- 평균 속도 / 누적 거리 / 정차 시간 통계
- 위험 구간 / 주의 구간 표시

---

## 3. 추천 기술 스택 (실제 채택 스택)

## 프론트엔드 (apps/mobile)
- React Native (Expo SDK 51)
- TypeScript
- react-native-maps
- Zustand (상태)
- @tanstack/react-query (서버 상태)
- expo-location (GPS)

## 백엔드 (apps/api)
- Node.js 20
- Express 4 + TypeScript
- PostgreSQL 16 + PostGIS 3.4
- Redis 7 (선택적 캐시, `REDIS_ENABLED`로 on/off)
- node-postgres(`pg`) 직접 사용 + raw SQL 마이그레이션
- zod (요청 유효성 검증), helmet, morgan, compression, cors

## 인프라 / 로컬 개발
- docker-compose 로 Postgres(PostGIS) + Redis 동시 기동
- 루트 `.env` 1개로 API/모바일/DB 모든 환경변수 관리
  (모바일은 `EXPO_PUBLIC_*` 접두사만 클라이언트 노출)

## 지도 / 위치 / 외부 API
- 카카오 로컬 API: 주변 시설 검색
- 공공데이터포털: 자전거길 / 인증센터 / 주변시설 원천 데이터
- GPX/KML 파서: 경로 데이터 적재
- 선택: Mapbox Directions / OSRM / GraphHopper

## 디자인 / UI 원칙
- **모바일 애플리케이션 전용 UI** 기준으로 설계
- **흑백(Black & White) 중심 디자인** 적용
- 불필요한 컬러 강조 제거
- 불필요한 장식 요소 및 아이콘 최소화
- 정보 위계는 텍스트 크기, 두께, 여백으로 구분
- 지도 화면에서도 버튼 수를 최소화하여 주행 중 인지 부담 감소
- 핵심 정보(현재 속도, 남은 거리, ETA, 다음 인증센터)만 전면 배치

---

## 4. 외부 데이터 소스 정리

### 공공데이터 (확보 완료)
1. **행정안전부 자전거길 공식 자료** — `/data/raw/`
   - `gukto_routes.csv` (53,418 점, 42개 노선 polyline)
   - `gukto_pois.csv` (1,133개: 인증센터/화장실/급수대/공기주입기)
   - `route_codebook.xlsx` (ROAD_SN 1~46 ↔ 노선명)
   - 인코딩: CP949
   - 적재: `npm run import:official`

2. 생활안전지도 자전거길 관련 정보 (확보 예정)
   - 사고지점
   - 안전시설 정보

### 추가 확보 권장 데이터
- 국토종주 전체 GPX 파일
- 구간별 인증센터 좌표
- 쉼터 / 급수대 / 화장실 / 숙소 수기 보강 데이터

### 주변 시설 API
- 카카오 로컬 API
  - 카테고리 기반 반경 검색
  - 키워드 기반 장소 검색

### 선택 API
- 기상청 단기예보 API
- 고도 API 또는 SRTM 고도 데이터

---

## 5. 시스템 구조

```text
[모바일 앱]
  ├─ GPS 수집
  ├─ 경로 표시
  ├─ 진행률 계산
  ├─ ETA 계산
  └─ 주변 시설 조회
         │
         ▼
[백엔드 API]
  ├─ 자전거 코스 목록 제공
  ├─ GPX 파싱 후 경로 제공
  ├─ 인증센터/POI 제공
  ├─ 사용자 기록 저장
  └─ 캐시 처리
         │
         ├─ PostgreSQL/PostGIS
         ├─ Redis
         ├─ 공공데이터 원본
         └─ Kakao Local API
```

---

## 6. 핵심 데이터 모델

## 6.1 course
국토종주 전체 혹은 세부 코스 단위.
공식 자료 적재 시 `road_sn`(행정안전부 ROAD_SN)을 유니크 키로 사용한다.

```sql
CREATE TABLE course (
  id BIGSERIAL PRIMARY KEY,
  road_sn INT,                   -- 행정안전부 공식 노선코드 (1~46)
  name VARCHAR(200) NOT NULL,
  description TEXT,
  total_distance_km NUMERIC(8,2),
  gpx_file_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_course_road_sn ON course(road_sn) WHERE road_sn IS NOT NULL;
```

## 6.2 course_segment
코스를 여러 세부 구간으로 분리

```sql
CREATE TABLE course_segment (
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
CREATE INDEX idx_course_segment_geom ON course_segment USING GIST(geom);
```

## 6.3 poi
주변 시설 / 인증센터 / 쉼터 등 공통 저장

```sql
CREATE TABLE poi (
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT REFERENCES course(id) ON DELETE SET NULL,
  segment_id BIGINT REFERENCES course_segment(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  source VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_poi_type ON poi(type);
```

### poi.type 예시
공식 자료(행정안전부) 기준
- `certification_center` (인증센터, 92개)
- `restroom` (화장실, 793개)
- `water_station` (급수대, 185개)
- `air_pump` (공기주입기, 63개)

외부 API/내부 보강
- `convenience_store` (편의점, Kakao)
- `restaurant` (식당, Kakao)
- `lodging` (숙소, Kakao)
- `cafe` (카페, Kakao)
- `bike_repair` (자전거 수리)
- `shelter` (쉼터)

## 6.4 ride_session
사용자 주행 기록

```sql
CREATE TABLE ride_session (
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
```

## 6.5 ride_track_point
실시간 위치 히스토리

```sql
CREATE TABLE ride_track_point (
  id BIGSERIAL PRIMARY KEY,
  ride_session_id BIGINT NOT NULL REFERENCES ride_session(id) ON DELETE CASCADE,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  speed_kmh NUMERIC(6,2),
  altitude_m NUMERIC(8,2),
  recorded_at TIMESTAMP NOT NULL
);
```

---

## 7. API 설계

## 7.1 코스 조회
```http
GET /api/courses
GET /api/courses/:id
GET /api/courses/:id/segments
GET /api/courses/:id/pois
```

## 7.2 주변 시설 조회
```http
GET /api/nearby?lat=37.123&lng=127.123&type=convenience_store&radius=2000
```

## 7.3 라이딩 시작 / 종료
```http
POST /api/rides/start
POST /api/rides/:id/track
POST /api/rides/:id/end
GET /api/rides/:id
```

## 7.4 경로 진행 상태 계산
```http
POST /api/navigation/progress
Content-Type: application/json

{
  "courseId": 1,
  "lat": 37.123456,
  "lng": 127.123456,
  "speedKmh": 21.4
}
```

### 응답 예시
```json
{
  "snapped": {
    "lat": 37.1234,
    "lng": 127.1234
  },
  "remainingDistanceKm": 42.8,
  "estimatedDurationMin": 122,
  "estimatedArrivalAt": "2026-04-20T17:42:00+09:00",
  "offRoute": false,
  "nextPoi": {
    "type": "certification_center",
    "name": "여주보 인증센터",
    "distanceKm": 8.2
  }
}
```

---

## 8. 핵심 계산 로직

## 8.1 현재 위치를 경로에 스냅
사용자 GPS 좌표를 경로 선분(LineString) 위 최근접 점으로 보정한다.

### 목적
- GPS 오차 완화
- 현재 진행 위치 계산 정확도 향상
- 남은 거리 산정 정확도 확보

### 방법
- PostGIS `ST_ClosestPoint`
- 또는 앱/서버에서 polyline segment 최소 거리 계산

## 8.2 남은 거리 계산
- 전체 경로 길이 계산
- 스냅된 현재 위치까지 누적 거리 계산
- `남은 거리 = 전체 거리 - 현재 누적 거리`

## 8.3 ETA 계산
- 즉시 속도보다 최근 1~3분 평균 속도 권장
- `예상 소요 시간 = 남은 거리 / 평균 속도`
- `도착 예정 시각 = 현재 시각 + 예상 소요 시간`

## 8.4 경로 이탈 감지
- 현재 위치와 최근접 경로 간 거리 계산
- 예: 50m 이상 벗어나면 이탈 경고
- 속도와 도로 상황에 따라 동적 기준 적용 가능

---

## 9. 주변 시설 조회 방식

## 방식 1. 내부 DB 우선
공공데이터로 구축한 POI DB에서 먼저 조회

장점
- 빠름
- 비용 적음
- 오프라인 캐시 가능

## 방식 2. 외부 API 보완
카카오 로컬 API로 추가 검색

장점
- 최신 상호 반영 가능
- 숙소/식당 검색 정확도 향상

## 권장 전략
- 인증센터 / 화장실 / 주요 쉼터 = 내부 DB 고정
- 편의점 / 식당 / 숙소 = 카카오 API 보완

---

## 10. 카카오 로컬 API 카테고리 매핑

```text
CS2 = 편의점
FD6 = 음식점
CE7 = 카페
AD5 = 숙박
PK6 = 주차장
SW8 = 지하철역 (필요 시)
```

### 반경 검색 예시
```http
GET https://dapi.kakao.com/v2/local/search/category.json
  ?category_group_code=CS2
  &x=127.123456
  &y=37.123456
  &radius=2000
  &sort=distance
```

---

## 11. 프론트 화면 구조

## 11.1 홈 화면
- 코스 선택
- 전체 국토종주 / 세부 구간 선택
- 최근 라이딩 이어하기
- 흑백 기반 단순 카드형 UI
- 아이콘 없이 텍스트 중심 메뉴 구성

## 11.2 라이딩 화면 (핵심)
- 지도
- 현재 위치 마커
- 경로 polyline
- 현재 속도
- 평균 속도
- 남은 거리
- 남은 시간
- 도착 예정 시각
- 주변 시설 빠른 버튼
- 다음 인증센터 정보
- 하단 정보 패널은 흑백 단색 UI로 구성
- 주행 중 오조작 방지를 위해 버튼 개수 최소화

## 11.3 주변 시설 화면
- 편의점
- 화장실
- 식당
- 숙소
- 지도/리스트 전환
- 거리순 정렬
- 아이콘 대신 텍스트 라벨과 거리 정보 위주 표시

## 11.4 기록 화면
- 주행 시간
- 평균 속도
- 총 거리
- 경로 재생
- 차트도 장식 없이 단색 라인/막대 중심으로 단순 구성

## 11.5 설정 화면
- GPS 갱신 주기
- 배터리 절약 모드
- 오프라인 데이터 다운로드
- 속도 단위 / 거리 단위
- 다크/라이트가 아닌 흑백 고정 테마 기준 설계

---

## 12. React Native 상태 구조 예시

```ts
export interface NavigationState {
  selectedCourseId: number | null;
  currentLocation: {
    lat: number;
    lng: number;
    speedKmh?: number;
    heading?: number;
  } | null;
  snappedLocation: {
    lat: number;
    lng: number;
  } | null;
  remainingDistanceKm: number;
  estimatedDurationMin: number;
  estimatedArrivalAt: string | null;
  offRoute: boolean;
  nearbyPois: NearbyPoi[];
}
```

---

## 13. 지도 표시용 프론트 코드 예시

```tsx
import React from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';

interface Coord {
  latitude: number;
  longitude: number;
}

interface Props {
  currentLocation: Coord;
  routeCoords: Coord[];
  certificationCenters: Coord[];
}

export default function RidingMap({
  currentLocation,
  routeCoords,
  certificationCenters,
}: Props) {
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      showsUserLocation
      followsUserLocation
    >
      <Polyline coordinates={routeCoords} strokeWidth={4} />

      <Marker
        coordinate={currentLocation}
        title="현재 위치"
      />

      {certificationCenters.map((item, idx) => (
        <Marker
          key={idx}
          coordinate={item}
          title={`인증센터 ${idx + 1}`}
        />
      ))}
    </MapView>
  );
}
```

---

## 14. 백엔드 진행률 계산 예시

```ts
import { Request, Response } from 'express';

export async function getProgress(req: Request, res: Response) {
  const { courseId, lat, lng, speedKmh } = req.body;

  // 1. course polyline 조회
  // 2. 현재 위치를 경로 위 최근접 지점으로 snap
  // 3. 현재 누적 거리 계산
  // 4. 남은 거리 계산
  // 5. ETA 계산
  // 6. 다음 인증센터 계산

  const remainingDistanceKm = 42.8;
  const estimatedDurationMin = speedKmh > 0 ? Math.round((remainingDistanceKm / speedKmh) * 60) : null;

  return res.json({
    snapped: { lat, lng },
    remainingDistanceKm,
    estimatedDurationMin,
    estimatedArrivalAt: estimatedDurationMin
      ? new Date(Date.now() + estimatedDurationMin * 60 * 1000).toISOString()
      : null,
    offRoute: false,
    nextPoi: {
      type: 'certification_center',
      name: '다음 인증센터',
      distanceKm: 8.2,
    },
  });
}
```

---

## 15. 오프라인 전략

## 반드시 로컬 저장할 것
- 선택 코스 GPX/polyline
- 인증센터 목록
- 주요 화장실 / 쉼터 / 편의점 핵심 데이터

## 선택 저장
- 최근 조회 주변 시설
- 최근 주행 기록

## 방식
- 앱 최초 다운로드 후 코스별 오프라인 패키지 저장
- SQLite 또는 MMKV + 파일 캐시 사용

---

## 16. 개발 우선순위

## 1단계 MVP
- 코스 선택
- 지도 위 경로 표시
- 현재 위치 표시
- 남은 거리 / ETA 계산
- 주변 편의점 / 화장실 / 식당 / 숙소 조회
- 인증센터 표시

## 2단계
- 주행 기록 저장
- 오프라인 데이터 저장
- 이탈 경고
- 다음 인증센터까지 거리 표시

## 3단계
- 날씨
- 고도
- 위험 구간 알림
- 소셜/랭킹/공유 기능

---

## 17. 실제 구현 시 주의사항
- GPS 즉시 속도는 튈 수 있으므로 평균값 보정 필요
- 국토종주 전체 경로는 segment 단위로 나눠야 성능이 좋음
- POI는 공공데이터만으로 부족하므로 외부 API 보완이 필요함
- 경로 이탈 판정은 너무 엄격하면 오탐 많음
- 배터리 절약을 위해 백그라운드 위치 추적 주기 최적화 필요

---

## 18. 개발자 전달용 한줄 요약
이 앱은 **국토종주 GPX 기반 경로 표시 + GPS 현재 위치 스냅 + 남은 거리/ETA 계산 + 카카오/공공데이터 기반 주변 시설 탐색**이 핵심이며, **모바일 전용 흑백 UI / 최소 아이콘 / 최소 조작 구조**를 전제로 MVP를 구현한다.

---

## 19. 개발자 전달용 축약 요구사항

### 서비스 한줄 정의
국토종주 이용자를 위한 **모바일 전용 자전거 네비게이션 앱**으로, 현재 위치와 경로 진행률, 남은 거리, 도착 예정 시간, 주변 편의시설을 단순하고 직관적인 흑백 UI로 제공한다.

### 핵심 기능 요약
- 국토종주 코스 선택
- 현재 위치 기반 경로 안내
- 남은 거리 / ETA 계산
- 경로 이탈 감지
- 인증센터 및 주변 시설 조회
- 오프라인 일부 지원

### UI/디자인 요약
- 모바일 앱 전용 화면 설계
- 흑백 중심
- 쓸데없는 아이콘 제거
- 텍스트 중심 정보 구조
- 주행 중 필요한 버튼만 최소 배치

### MVP 범위
- 지도 위 경로 표시
- 현재 위치 표시
- 현재 속도 / 남은 거리 / ETA 표시
- 인증센터 표시
- 주변 편의점 / 화장실 / 식당 / 숙소 표시

### 비기능 요구사항
- 배터리 효율 고려
- GPS 오차 보정
- 저속/정차 시 ETA 튐 방지
- 구간 단위 로딩으로 성능 확보

---

## 20. 실제 프로젝트 구조 (구현 완료 기준)

```text
msnavi/
├─ apps/
│  ├─ mobile/                      # Expo (React Native)
│  │  ├─ src/
│  │  │  ├─ App.tsx
│  │  │  ├─ navigation/
│  │  │  │  ├─ RootNavigator.tsx
│  │  │  │  └─ types.ts
│  │  │  ├─ screens/
│  │  │  │  ├─ HomeScreen.tsx
│  │  │  │  ├─ RideScreen.tsx
│  │  │  │  ├─ NearbyScreen.tsx
│  │  │  │  ├─ HistoryScreen.tsx
│  │  │  │  └─ SettingsScreen.tsx
│  │  │  ├─ components/
│  │  │  │  ├─ RouteMap.tsx
│  │  │  │  ├─ RideStatsPanel.tsx
│  │  │  │  ├─ NearbyList.tsx
│  │  │  │  └─ MonoButton.tsx
│  │  │  ├─ store/
│  │  │  │  ├─ navigationStore.ts
│  │  │  │  ├─ rideStore.ts
│  │  │  │  └─ settingsStore.ts
│  │  │  ├─ services/
│  │  │  │  ├─ api.ts
│  │  │  │  └─ location.ts
│  │  │  ├─ hooks/
│  │  │  │  ├─ useRideTracking.ts
│  │  │  │  ├─ useCourse.ts
│  │  │  │  └─ useNearbyPois.ts
│  │  │  ├─ theme/index.ts         # 흑백 테마
│  │  │  └─ config/appConfig.ts
│  │  ├─ app.json
│  │  ├─ babel.config.js
│  │  ├─ index.ts
│  │  └─ package.json
│  └─ api/                         # Express + TS + pg
│     ├─ src/
│     │  ├─ config/env.ts          # .env 로더 + 검증
│     │  ├─ db/
│     │  │  ├─ pool.ts
│     │  │  ├─ redis.ts
│     │  │  ├─ migrate.ts
│     │  │  ├─ seed.ts
│     │  │  └─ migrations/
│     │  │     ├─ 001_init.sql     # PostGIS 스키마 + 인덱스
│     │  │     └─ 002_seed.sql
│     │  ├─ controllers/
│     │  │  ├─ course.controller.ts
│     │  │  ├─ navigation.controller.ts
│     │  │  ├─ nearby.controller.ts
│     │  │  └─ ride.controller.ts
│     │  ├─ services/
│     │  │  ├─ course.service.ts
│     │  │  ├─ navigation.service.ts
│     │  │  ├─ nearby.service.ts
│     │  │  └─ ride.service.ts
│     │  ├─ routes/
│     │  ├─ middlewares/
│     │  │  ├─ error-handler.ts
│     │  │  └─ validate.ts
│     │  ├─ utils/
│     │  │  ├─ geo.ts              # 스냅/거리 계산
│     │  │  └─ http-error.ts
│     │  ├─ app.ts
│     │  └─ server.ts
│     ├─ tsconfig.json
│     ├─ Dockerfile
│     └─ package.json
├─ packages/
│  ├─ shared-types/src/index.ts
│  └─ shared-utils/src/index.ts
├─ docs/
│  ├─ gukto-bike-navigation-spec.md
│  └─ api-spec.md
├─ docker-compose.yml              # postgres(postgis) + redis
├─ .env.example
├─ .gitignore
├─ package.json                    # npm workspaces
└─ README.md
```

## 21. 개발자 전달용 API 명세 요약

### 코스
```http
GET /api/courses
GET /api/courses/:courseId
GET /api/courses/:courseId/segments
GET /api/courses/:courseId/pois
```

### 진행률
```http
POST /api/navigation/progress
```

요청 예시
```json
{
  "courseId": 1,
  "lat": 37.5665,
  "lng": 126.9780,
  "speedKmh": 18.5
}
```

응답 예시
```json
{
  "remainingDistanceKm": 87.4,
  "estimatedDurationMin": 283,
  "estimatedArrivalAt": "2026-04-20T18:30:00+09:00",
  "offRoute": false,
  "nextPoi": {
    "type": "certification_center",
    "name": "다음 인증센터",
    "distanceKm": 12.1
  }
}
```

### 주변 시설
```http
GET /api/nearby?lat=37.5665&lng=126.9780&type=restroom&radius=2000
```

### 라이딩 기록
```http
POST /api/rides/start
POST /api/rides/:rideId/track
POST /api/rides/:rideId/end
GET /api/rides/:rideId
```

## 22. 화면별 디자인 가이드

### 공통 원칙
- 배경: 흰색 또는 검정 단색
- 텍스트: 검정/흰색 대비만 사용
- 강조: 회색 톤 1~2단계만 사용
- 테두리: 얇은 선 중심
- 그림자/그라데이션/장식 요소 최소화
- 아이콘은 꼭 필요한 경우에만 제한적으로 사용

### 홈 화면
- 코스 리스트를 텍스트 카드 형태로 배치
- 썸네일 이미지 없이도 구분 가능하도록 제목/거리/구간 정보 중심 구성

### 라이딩 화면
- 상단: 현재 속도 / 남은 거리 / ETA
- 중앙: 지도
- 하단: 다음 인증센터 / 주변 시설 버튼
- 버튼은 2~4개 이내 유지

### 주변 시설 화면
- 리스트 우선
- 장소명 / 거리 / 유형만 먼저 노출
- 상세 진입 시 주소와 길안내 제공

### 기록 화면
- 총 거리 / 주행 시간 / 평균 속도 중심
- 시각 효과보다 숫자 정보 전달 우선

---

## 23. 바로 다음 작업 추천
1. 국토종주 GPX 원본 확보
2. 공공데이터 파일 수집 및 정규화
3. PostgreSQL/PostGIS 스키마 생성
4. 코스/POI 적재 스크립트 작성
5. React Native 지도 화면 MVP 제작
6. 진행률 계산 API 구현
7. 주변시설 조회 API 연결

---

## 24. 로컬 개발 환경 / 인프라 (구현 반영)

### 24.1 컨테이너 (docker-compose)

| 서비스 | 이미지 | 포트 | 비고 |
| --- | --- | --- | --- |
| postgres | `postgis/postgis:16-3.4-alpine` | 5432 | `apps/api/src/db/migrations/*.sql` 자동 실행 |
| redis | `redis:7-alpine` | 6379 | 카카오 API/쿼리 결과 캐시 |

`docker compose up -d` 로 동시 기동. 초기화 스크립트 재실행은 `docker compose down -v && docker compose up -d`.

### 24.2 환경변수 (.env)

루트 `.env` 1개로 API/모바일 모두 관리.

```dotenv
NODE_ENV=development
API_HOST=0.0.0.0
API_PORT=4000

# 테스트 서버 IP (로컬호스트가 아닌 팀 공용 IP)
CORS_ORIGINS=http://172.22.0.148:4000,http://172.22.0.148:8081,http://172.22.0.148:19006,http://localhost:4000,http://localhost:8081,http://localhost:19006

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=msnavi
POSTGRES_USER=msnavi
POSTGRES_PASSWORD=msnavi_dev_pw

REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TTL_SEC=300

KAKAO_REST_API_KEY=...
EXPO_PUBLIC_API_BASE_URL=http://172.22.0.148:4000
```

`.env.example`이 리포에 포함되어 있고, 실제 `.env`는 `.gitignore` 처리됨.

### 24.3 CORS 정책

- `CORS_ORIGINS`에 등록된 origin만 허용 (콤마 구분)
- 기본적으로 **팀 테스트 IP `172.22.0.148`** 의 4000/8081/19006 포트 허용
- origin 없는 요청(curl, 서버-서버, 헬스체크)은 통과
- credentials 허용, preflight(`OPTIONS *`) 처리 포함

### 24.4 Redis 캐시 레이어

- `REDIS_ENABLED=false` 이면 전체 캐시 호출이 no-op (서버 정상 동작)
- 주요 캐시 키 TTL
  - `courses:list` 60초
  - `courses:{id}:segments` 300초
  - `courses:{id}:polyline` 600초
  - `kakao:{code}:{lat}:{lng}:{radius}` 300초

### 24.5 GitHub 연동

- Remote: `https://github.com/myoungsuking/msnavi.git`
- 기본 브랜치: `main`
- 토큰/민감정보는 커밋되지 않으며 `.gitignore`에 `git_info`, `.env` 등록됨

---

## 25. 공식 데이터 ETL (행정안전부 자전거길)

### 25.1 파일 배치

```
data/raw/
├─ gukto_routes.csv       # 노선 좌표 시퀀스 (CP949)
├─ gukto_pois.csv         # 주변시설 (CP949)
├─ route_codebook.xlsx    # ROAD_SN ↔ 노선명
└─ README.md
```

### 25.2 스키마 매핑

| 원본 | 대상 |
| --- | --- |
| `gukto_routes.csv` → `국토종주 자전거길`(ROAD_SN) | `course.road_sn` (upsert key) + 노선명(코드북) |
| `gukto_routes.csv` 의 각 행 | `course_segment.geom` 의 LINESTRING 한 점 (seq순 정렬) |
| `gukto_pois.csv` → `구분` | `poi.type` (매핑 아래) |
| `gukto_pois.csv` → `이름/경도/위도` | `poi.name/lng/lat` |

POI 타입 매핑
- `인증센터` → `certification_center`
- `화장실` → `restroom`
- `급수대` → `water_station`
- `공기주입기` → `air_pump`

인증센터만 `이름`이 개별 명칭이고, 나머지 타입은 노선명("아라길" 등)이 들어있으므로
`name` 필드는 `"급수대 (아라길)"` 형태로 생성하고, 원본은 `metadata.routeName`에 보관.

### 25.3 실행

```bash
docker compose up -d          # postgres+redis 기동 (최초 기동 시 001_init, 003_extend 자동 실행)
cd apps/api
npm install
npm run import:official       # data/raw/*.csv 읽어 DB 적재 (upsert)
```

### 25.4 적재 결과 (기대값)

- course: **42** rows (ROAD_SN 1~46 중 "노선변경 미사용" 4개 제외)
- course_segment: **42** rows (노선당 1개, `total_distance_km`는 `ST_Length` 로 자동 계산)
- poi: **최대 1,133** rows (동일 type+name+좌표(소수 4자리) upsert)

### 25.5 노선 코드북 (요약)

| ROAD_SN | 노선명 |
| --- | --- |
| 1 | 아라자전거길 |
| 2 | 한강종주자전거길 |
| 3 | 남한강자전거길 |
| 4 | 새재자전거길 |
| 5 | 낙동강자전거길 |
| 6 | 금강자전거길 |
| 7 | 영산강자전거길 |
| 8 | 북한강자전거길 |
| 9 | 섬진강자전거길 |
| 10 | 오천자전거길 |
| 11 | 동해안(강원)자전거길 |
| 12 | 동해안(경북)자전거길 |
| 13 | 제주환상자전거길 |
| 14~46 | 지역 자전거길(강릉/화천/옹진/파주/옥천/정읍/신안/경주/진도/완도/고흥/여수/군산/울릉/사천/남해/제주 등) |

전체 매핑은 `apps/api/src/scripts/import-official.ts` 의 `ROUTE_CODEBOOK` 상수 참조.
