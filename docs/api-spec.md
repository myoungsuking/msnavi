# msnavi API 명세서 (v0.1)

- Base URL (개발): `http://172.22.0.148:4000/api`
- 공통 응답: JSON
- 인증: **현 단계 MVP에서는 미적용** (차후 JWT/세션 도입 예정)
- 에러 포맷
```json
{ "error": { "message": "...", "code": "BAD_REQUEST", "details": {} } }
```

---

## 헬스체크

### `GET /api/health`

```json
{
  "ok": true,
  "env": "development",
  "db": true,
  "redis": true,
  "now": "2026-04-20T03:12:00.000Z"
}
```

---

## 1. 코스

### `GET /api/courses`
```json
{ "items": [ { "id": 1, "name": "국토종주 (인천~부산)", "total_distance_km": "633.00", ... } ] }
```

### `GET /api/courses/:id`
단일 코스 상세.

### `GET /api/courses/:id/segments`
코스를 구성하는 세그먼트들. `coordinates`는 `[lng, lat]` 쌍 배열.
```json
{
  "items": [
    {
      "id": 1, "course_id": 1, "name": "여의도 ~ 잠실", "seq": 1,
      "distance_km": "14.50",
      "start_point_name": "여의도", "end_point_name": "잠실",
      "coordinates": [[126.9166, 37.5272], [126.9368, 37.5186], ...]
    }
  ]
}
```

### `GET /api/courses/:id/pois?type=certification_center`
코스에 매핑된 POI 목록. `type` 없으면 전부.
```json
{
  "items": [
    { "id": 1, "type": "certification_center", "name": "여의도 인증센터", "lat": 37.5272, "lng": 126.9166, "address": "..." }
  ]
}
```

---

## 2. 주변 시설

### `GET /api/nearby`

| 쿼리 | 필수 | 설명 |
| --- | --- | --- |
| `lat` | ✅ | -90 ~ 90 |
| `lng` | ✅ | -180 ~ 180 |
| `type` | - | `certification_center` / `convenience_store` / `restroom` / `restaurant` / `lodging` / `cafe` / `bike_repair` / `shelter` |
| `radius` | - | 미터 단위, 기본 2000 (50~20000) |
| `source` | - | `db` / `kakao` / `auto`(기본). `auto`는 type에 따라 DB+Kakao 혼합 |

응답:
```json
{
  "items": [
    {
      "id": 1, "type": "convenience_store", "name": "GS25 한강점",
      "address": "서울 영등포구", "lat": 37.5272, "lng": 126.9330,
      "distanceM": 142, "source": "db"
    }
  ]
}
```

---

## 3. 내비게이션 진행률

### `POST /api/navigation/progress`

요청:
```json
{
  "courseId": 1,
  "lat": 37.5205,
  "lng": 127.0820,
  "speedKmh": 18.5,
  "offRouteThresholdM": 50
}
```

응답:
```json
{
  "snapped": { "lat": 37.52049, "lng": 127.08201 },
  "progressKm": 14.500,
  "totalKm": 36.800,
  "remainingDistanceKm": 22.300,
  "estimatedDurationMin": 72,
  "estimatedArrivalAt": "2026-04-20T09:42:00.000Z",
  "offRoute": false,
  "offRouteDistanceM": 3,
  "nextPoi": {
    "id": 3,
    "type": "certification_center",
    "name": "팔당 인증센터",
    "lat": 37.5380,
    "lng": 127.3200,
    "distanceKm": 22.3
  }
}
```

**계산 로직**
- 현재 좌표를 코스 polyline의 최근접 지점으로 스냅 (평면 근사)
- 스냅 지점까지의 누적거리로 진행률/남은 거리 계산
- `speedKmh > 1` 일 때만 ETA 계산
- 경로 이탈: 스냅 거리 > `offRouteThresholdM`(기본 50m)
- `nextPoi`: 진행거리보다 앞쪽에 있는 가장 가까운 인증센터

---

## 4. 라이딩 세션

### `POST /api/rides/start`
요청:
```json
{ "courseId": 1, "segmentId": null, "userId": null }
```
응답: 생성된 `ride_session` 전체 필드.

### `POST /api/rides/:id/track`
GPS 샘플 일괄 업로드(최대 500개).
```json
{
  "points": [
    {
      "lat": 37.5272, "lng": 126.9166,
      "speedKmh": 18.4, "altitudeM": 21.0,
      "recordedAt": "2026-04-20T03:11:50.000Z"
    }
  ]
}
```
응답:
```json
{ "inserted": 1 }
```

### `POST /api/rides/:id/end`
```json
{
  "totalDistanceKm": 42.8,
  "avgSpeedKmh": 17.2,
  "maxSpeedKmh": 34.1,
  "movingTimeSec": 8900,
  "stoppedTimeSec": 900
}
```
응답: 갱신된 `ride_session`.

### `GET /api/rides/:id`
```json
{
  "session": { "id": 1, "course_id": 1, "status": "ENDED", ... },
  "trackPoints": [
    { "lat": 37.5272, "lng": 126.9166, "speed_kmh": 18.4, "altitude_m": 21, "recorded_at": "..." }
  ]
}
```

---

## CORS

`.env` 의 `CORS_ORIGINS` 에 나열된 origin만 허용.
모바일/브라우저에서 접근 시 반드시 허용 목록에 추가.
기본값 예: `http://172.22.0.148:4000, http://172.22.0.148:8081, http://172.22.0.148:19006, http://localhost:*`.

## 에러 코드

| HTTP | code | 설명 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | 유효성 실패 (zod `details` 동봉) |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 500 | `INTERNAL` | 서버 오류 |
