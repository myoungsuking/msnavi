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

**운영 도메인 / CORS**: 운영은 `https://msnavi.msking.co.kr` (Cloudflare → 테스트 서버 `172.22.0.148:4000`) 를 통해 접근합니다.
CORS 는 운영 도메인 + 사내 IP(`172.22.0.148`) + `localhost` 를 기본 허용하도록 설정되어 있으며, 다른 환경에서는 `CORS_ORIGINS` 값을 덮어쓰면 됩니다.

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
npm run dev   # 로컬: http://localhost:4000 / 사내: http://172.22.0.148:4000 / 운영: https://msnavi.msking.co.kr (Cloudflare)
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
> 주소로 지정해야 합니다.
> - 외부망 테스트/배포: `https://msnavi.msking.co.kr` (Cloudflare, 기본값)
> - 사내 LAN 테스트: `http://172.22.0.148:4000`
> - `localhost` 는 실제 디바이스에서 동작하지 않습니다.

## 환경변수 요약

| 변수 | 설명 | 기본값 |
| --- | --- | --- |
| `API_HOST` / `API_PORT` | API 바인딩 | `0.0.0.0` / `4000` |
| `CORS_ORIGINS` | 허용 origin 목록(콤마) | `https://msnavi.msking.co.kr, http://172.22.0.148:*, http://localhost:*` |
| `POSTGRES_*` | Postgres 접속 정보 | `localhost:5432/msnavi` |
| `REDIS_ENABLED` | Redis 캐시 on/off | `true` |
| `REDIS_*` | Redis 접속 정보 | `localhost:6379` |
| `KAKAO_REST_API_KEY` | 카카오 로컬 API 키 | (필수) |
| `EXPO_PUBLIC_API_BASE_URL` | 모바일 → API base URL | `https://msnavi.msking.co.kr` |

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

## 외부 노출 (Cloudflare Tunnel)

테스트 서버(`172.22.0.148`)의 API 를 **외부 인터넷에서 `https://msnavi.msking.co.kr`** 으로 접근할 수 있게
**Cloudflare Tunnel (`cloudflared`)** 을 사용합니다.

### 구조

```
모바일 앱 / 브라우저
      │  (HTTPS)
      ▼
https://msnavi.msking.co.kr       ← Cloudflare 엣지 (TLS 종단)
      │  (QUIC, outbound-only 터널)
      ▼
cloudflared (systemd 서비스, 테스트 서버 내부에서 구동)
      │  (HTTP, 평문, 내부망)
      ▼
http://172.22.0.148:4000/api/*  ← Express API
```

- 방화벽에 인바운드 포트를 열 필요가 없습니다 (cloudflared 가 Cloudflare 엣지로 아웃바운드 연결).
- 라우팅은 Cloudflare 대시보드 → **Networking → Tunnels → Public Hostnames** 에서 관리.
- 터널 ID: `a822704c-2c3c-488e-95e0-07b4d9285b90` (msnavi 전용, crm 등 타 서비스와 분리)

### 서버 (172.22.0.148) 운영 명령

cloudflared 는 systemd 서비스로 등록되어 있어 **재부팅 시 자동 시작**, **SSH 세션과 무관하게 상시 구동** 됩니다.

```bash
sudo systemctl status cloudflared      # 상태 확인
sudo systemctl restart cloudflared     # 재시작
sudo journalctl -u cloudflared -f      # 실시간 로그
sudo systemctl disable cloudflared     # (비상시) 자동시작 해제
```

### 최초 설치 (참고)

서버에 cloudflared 가 설치돼 있지 않을 때만 실행.

```bash
# 1) cloudflared 바이너리 설치 (Rocky Linux 9 / RHEL 계열)
sudo curl -L --output /tmp/cloudflared.rpm \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-x86_64.rpm
sudo rpm -ivh /tmp/cloudflared.rpm

# 2) 대시보드에서 발급한 connector 토큰으로 systemd 서비스 등록
sudo cloudflared service install <대시보드_connector_토큰>
sudo systemctl enable --now cloudflared
```

### 확인 (외부 연결)

```bash
curl -s https://msnavi.msking.co.kr/api/health
# → {"ok":true,"env":"development","db":true,"redis":true,"now":"..."}
```

---

## 배포 이력

- `main` 에 push 되면 GitHub Actions 가 자동으로 **Deployment 레코드**를 생성합니다.
- 레포 메인 페이지 우측 **Environments → `test`** 혹은 **Deployments 탭** 에서 시간순으로 확인.
- 자세한 동작 방식/추후 실제 SSH 배포 연결 방법은 [`docs/deployments.md`](docs/deployments.md) 참조.

## 기술 스택

- **Backend**: Node.js 20, Express 4, TypeScript, node-postgres(`pg`), ioredis, zod, helmet, morgan
- **DB**: PostgreSQL 16 + PostGIS 3.4
- **Cache**: Redis 7
- **Mobile**: Expo (React Native 0.74), react-native-maps, @tanstack/react-query, zustand, expo-location
- **Infra**: docker-compose

## 디자인 원칙 (모바일)

사양서 22번을 따름 — **흑백(Black & White) 중심**, 아이콘/장식 최소화, 텍스트/숫자 위주 정보 구조, 주행 중 오조작 방지.
