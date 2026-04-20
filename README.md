# msnavi — 국토종주 자전거 네비게이션

국토종주 자전거 이용자를 위한 **모바일 전용 네비게이션** 앱 + 백엔드 API 모노레포.

> 스펙 원문: [`docs/gukto-bike-navigation-spec.md`](docs/gukto-bike-navigation-spec.md)
> API 명세: [`docs/api-spec.md`](docs/api-spec.md)

## 구성

```
msnavi/
├─ apps/
│  ├─ api/           # Node.js + Express + TypeScript + PostgreSQL/PostGIS
│  └─ mobile/        # React Native (Expo) + react-native-maps
├─ packages/
│  ├─ shared-types/
│  └─ shared-utils/
├─ docs/
├─ docker-compose.yml # Postgres(PostGIS) + Redis
└─ .env.example
```

## 빠른 시작

### 1) 환경변수 준비

```bash
cp .env.example .env
# KAKAO_REST_API_KEY 등 필요한 값 채우기
```

**테스트 IP/CORS**: 팀 테스트 IP `172.22.0.148` 기준으로 기본 허용 origin이 설정되어 있습니다.
다른 환경에서는 `CORS_ORIGINS` 값을 덮어쓰면 됩니다.

### 2) 인프라 기동 (Postgres + Redis)

```bash
docker compose up -d
# postgres: 5432, redis: 6379
```

- Postgres 초기화 시 `apps/api/src/db/migrations/*.sql`이 자동 실행됩니다.
- 컨테이너를 이미 만든 뒤 스키마를 다시 적용하려면 `npm run docker:reset` 또는
  `npm run api:migrate && npm run api:seed`.

### 3) 백엔드 API 실행

```bash
cd apps/api
npm install
npm run dev   # http://172.22.0.148:4000 (API_HOST/API_PORT 로 변경 가능)
```

### 3-1) 공식 데이터 적재 (선택)

행정안전부 자전거길 공식 자료(42개 노선 + 1,133개 POI)를 DB에 적재:

```bash
cd apps/api
npm run import:official
```

- 입력: `data/raw/gukto_routes.csv`, `gukto_pois.csv` (CP949)
- 동작: `course.road_sn` upsert / 노선당 LINESTRING 1개 `course_segment` / POI upsert
- 자세한 내용은 [`data/raw/README.md`](data/raw/README.md) 및 스펙 문서 25장 참조

### 4) 모바일 앱 실행

```bash
cd apps/mobile
npm install
npm run start       # Expo 개발 서버
# 실제 기기에서 Expo Go 앱으로 QR 스캔
```

> 모바일에서 API를 호출하려면 `.env`의 `EXPO_PUBLIC_API_BASE_URL`을 기기가 접근 가능한
> IP(예: `http://172.22.0.148:4000`)로 지정해야 합니다.
> `localhost` 는 실제 디바이스에서 동작하지 않습니다.

## 환경변수 요약

| 변수 | 설명 | 기본값 |
| --- | --- | --- |
| `API_HOST` / `API_PORT` | API 바인딩 | `0.0.0.0` / `4000` |
| `CORS_ORIGINS` | 허용 origin 목록(콤마) | `http://172.22.0.148:*` 등 |
| `POSTGRES_*` | Postgres 접속 정보 | `localhost:5432/msnavi` |
| `REDIS_ENABLED` | Redis 캐시 on/off | `true` |
| `REDIS_*` | Redis 접속 정보 | `localhost:6379` |
| `KAKAO_REST_API_KEY` | 카카오 로컬 API 키 | (필수) |
| `EXPO_PUBLIC_API_BASE_URL` | 모바일 → API base URL | `http://172.22.0.148:4000` |

## 스크립트 (루트 기준)

| 명령 | 설명 |
| --- | --- |
| `npm run docker:up` | Postgres+Redis 기동 |
| `npm run docker:down` | 종료 |
| `npm run docker:reset` | 볼륨까지 삭제 후 재기동 |
| `npm run api:dev` | API 개발 서버 |
| `npm run api:build` | API TS 빌드 |
| `npm run api:migrate` | 마이그레이션 재실행 |
| `npm --workspace apps/api run import:official` | 행정안전부 공식 데이터 적재 |
| `npm run mobile:start` | Expo 개발 서버 |

## API 개요

자세한 요청/응답 포맷은 [`docs/api-spec.md`](docs/api-spec.md) 참조.

- `GET /api/health`
- `GET /api/courses` · `GET /api/courses/:id` · `GET /api/courses/:id/segments` · `GET /api/courses/:id/pois`
- `GET /api/nearby?lat=&lng=&type=&radius=&source=`
- `POST /api/navigation/progress`
- `POST /api/rides/start` · `POST /api/rides/:id/track` · `POST /api/rides/:id/end` · `GET /api/rides/:id`

## 기술 스택

- **Backend**: Node.js 20, Express 4, TypeScript, node-postgres(`pg`), ioredis, zod, helmet, morgan
- **DB**: PostgreSQL 16 + PostGIS 3.4
- **Cache**: Redis 7
- **Mobile**: Expo (React Native 0.74), react-native-maps, @tanstack/react-query, zustand, expo-location
- **Infra**: docker-compose

## 디자인 원칙 (모바일)

사양서 22번을 따름 — **흑백(Black & White) 중심**, 아이콘/장식 최소화, 텍스트/숫자 위주 정보 구조, 주행 중 오조작 방지.
