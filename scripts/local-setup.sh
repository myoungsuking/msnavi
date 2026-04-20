#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# msnavi 로컬 테스트 자동 실행 스크립트 (Docker 없이 네이티브 설치 버전)
# 실행:  sudo bash scripts/local-setup.sh
# 전제:  RHEL/Rocky/Alma 9 계열, Node 20, root 권한
# -----------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

log()  { printf "\n\033[1;34m[%s]\033[0m %s\n" "$(date +%H:%M:%S)" "$*"; }
ok()   { printf "\033[1;32m  ✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m  ! %s\033[0m\n" "$*"; }

PG_USER="msnavi"
PG_PASS="msnavi"
PG_DB="msnavi"
PG_PORT="5432"
REDIS_PORT="6379"

# -----------------------------------------------------------------------------
# 1) 패키지 설치
# -----------------------------------------------------------------------------
log "1) dnf 로 postgres / postgis / redis 설치"
if ! command -v postgres >/dev/null 2>&1; then
  dnf install -y --allowerasing \
    postgresql-server postgresql-contrib postgresql \
    postgis redis jq \
    || { warn "기본 repo 에 postgis 없을 수 있음. EPEL 추가 후 재시도"; \
         dnf install -y epel-release && \
         dnf install -y postgresql-server postgresql-contrib postgresql postgis redis jq; }
else
  ok "이미 설치됨"
fi
command -v pg_isready >/dev/null && ok "postgres $(pg_isready --version 2>/dev/null || true)"
command -v redis-server >/dev/null && ok "redis: $(redis-server --version | awk '{print $3}')"

# -----------------------------------------------------------------------------
# 2) Postgres 데이터디렉토리 초기화 + 기동 (systemd 없이 pg_ctl 직접)
# -----------------------------------------------------------------------------
PGDATA="/var/lib/pgsql/data"
log "2) Postgres 초기화 + 기동 (PGDATA=$PGDATA, port=$PG_PORT)"
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  /usr/bin/postgresql-setup --initdb || initdb -D "$PGDATA" -U postgres
  ok "initdb 완료"
else
  ok "이미 초기화되어 있음"
fi

# listen_addresses=localhost, port 설정
sed -i "s|^#\?listen_addresses.*|listen_addresses = 'localhost'|"   "$PGDATA/postgresql.conf"
sed -i "s|^#\?port *=.*|port = $PG_PORT|"                           "$PGDATA/postgresql.conf"
# 로컬에서 md5 허용
grep -q "host.*all.*all.*127.0.0.1/32.*md5" "$PGDATA/pg_hba.conf" || \
  echo "host all all 127.0.0.1/32 md5" >> "$PGDATA/pg_hba.conf"

chown -R postgres:postgres "$PGDATA"

if ! sudo -u postgres pg_isready -p "$PG_PORT" -h localhost >/dev/null 2>&1; then
  sudo -u postgres pg_ctl -D "$PGDATA" -l /tmp/pg.log start
  sleep 2
fi
sudo -u postgres pg_isready -p "$PG_PORT" -h localhost && ok "postgres 기동"

# -----------------------------------------------------------------------------
# 3) Redis 기동 (daemonize)
# -----------------------------------------------------------------------------
log "3) Redis 기동"
if ! pgrep -x redis-server >/dev/null; then
  redis-server --daemonize yes --port "$REDIS_PORT" --save "" --appendonly no
  sleep 1
fi
redis-cli -p "$REDIS_PORT" ping | grep -q PONG && ok "redis PONG"

# -----------------------------------------------------------------------------
# 4) DB/유저 + PostGIS + 마이그레이션
# -----------------------------------------------------------------------------
log "4) DB/유저/확장/마이그레이션"
sudo -u postgres psql -p "$PG_PORT" -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='$PG_USER') THEN
    CREATE ROLE $PG_USER LOGIN PASSWORD '$PG_PASS';
  END IF;
END \$\$;
SELECT 'db-exists' FROM pg_database WHERE datname='$PG_DB'\gset
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" | grep -q 1; then
  sudo -u postgres createdb -O "$PG_USER" "$PG_DB"
  ok "DB 생성: $PG_DB"
else
  ok "DB 존재: $PG_DB"
fi

sudo -u postgres psql -p "$PG_PORT" -d "$PG_DB" -v ON_ERROR_STOP=1 <<SQL
CREATE EXTENSION IF NOT EXISTS postgis;
GRANT ALL ON SCHEMA public TO $PG_USER;
SQL
ok "postgis 활성화"

export PGPASSWORD="$PG_PASS"
for f in apps/api/src/db/migrations/001_init.sql apps/api/src/db/migrations/003_extend.sql; do
  if [ -f "$f" ]; then
    psql -h localhost -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
    ok "applied $f"
  fi
done

# -----------------------------------------------------------------------------
# 5) .env 준비
# -----------------------------------------------------------------------------
log "5) .env 준비"
if [ ! -f .env ]; then
  cp .env.example .env
fi
# 필요한 값만 강제 세팅
python3 - <<'PY'
import re, pathlib
p = pathlib.Path('.env')
t = p.read_text()
def put(k, v):
    global t
    if re.search(rf'^{k}=', t, re.M):
        t = re.sub(rf'^{k}=.*$', f'{k}={v}', t, flags=re.M)
    else:
        t += f"\n{k}={v}\n"
for k, v in [
    ('DATABASE_URL', 'postgres://msnavi:msnavi@localhost:5432/msnavi'),
    ('REDIS_URL',    'redis://localhost:6379'),
    ('PORT',         '4000'),
    ('HOST',         '0.0.0.0'),
    ('CORS_ORIGINS', 'http://172.22.0.148:4000,http://localhost:4000,http://localhost:8081'),
    ('NODE_ENV',     'development'),
]:
    put(k, v)
p.write_text(t)
print('.env updated')
PY
ok ".env 준비"

# -----------------------------------------------------------------------------
# 6) 공식 자전거길 데이터 ETL (raw 폴더가 있으면)
# -----------------------------------------------------------------------------
log "6) 공식 자전거길 ETL (data/raw 있으면)"
if ls data/raw/*.csv >/dev/null 2>&1 || ls data/raw/* 2>/dev/null | grep -qi csv; then
  npm run api:import || warn "ETL 실패 — 로그 확인 필요"
else
  warn "data/raw 에 CSV 없음 — 스킵"
fi

# -----------------------------------------------------------------------------
# 7) API 빌드 후 백그라운드 기동
# -----------------------------------------------------------------------------
log "7) API 서버 기동 (포트 4000)"
# 이전 인스턴스 종료
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "node dist/server.js" 2>/dev/null || true
sleep 1
# 빌드 실행
npm --workspace apps/api run build
nohup node apps/api/dist/server.js > /tmp/api.log 2>&1 &
sleep 3

# -----------------------------------------------------------------------------
# 8) 엔드포인트 스모크 테스트
# -----------------------------------------------------------------------------
log "8) 엔드포인트 스모크 테스트"
set +e
echo "--- GET /api/health ---"
curl -sS -m 5 http://localhost:4000/api/health; echo
echo "--- GET /api/courses?limit=5 ---"
curl -sS -m 5 "http://localhost:4000/api/courses?limit=5" | head -c 800; echo
echo "--- GET /api/nearby (한강 여의도 근처) ---"
curl -sS -m 5 "http://localhost:4000/api/nearby?lat=37.5172&lng=126.9417&radius=2000&types=water_station,air_pump" | head -c 800; echo
set -e

log "DONE"
echo "API 로그:  tail -f /tmp/api.log"
echo "Postgres 로그: tail -f /tmp/pg.log"
echo "이어서 모바일: npm --workspace apps/mobile run start -- --tunnel"
