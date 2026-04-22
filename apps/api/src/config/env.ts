import dotenv from 'dotenv';
import path from 'path';

// .env 파일 로드 (루트와 api 폴더 모두 지원)
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`환경변수 ${name} 가 설정되지 않았습니다.`);
  }
  return v;
}

function toBool(v: string | undefined, fallback = false): boolean {
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

function toInt(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',

  host: process.env.API_HOST ?? '0.0.0.0',
  port: toInt(process.env.API_PORT, 4000),

  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  pg: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: toInt(process.env.POSTGRES_PORT, 5432),
    database: process.env.POSTGRES_DB ?? 'msnavi',
    user: process.env.POSTGRES_USER ?? 'msnavi',
    password: process.env.POSTGRES_PASSWORD ?? 'msnavi_dev_pw',
    ssl: toBool(process.env.POSTGRES_SSL, false),
  },

  redis: {
    enabled: toBool(process.env.REDIS_ENABLED, false),
    host: process.env.REDIS_HOST ?? 'localhost',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    ttlSec: toInt(process.env.REDIS_TTL_SEC, 300),
  },

  kakao: {
    restApiKey: process.env.KAKAO_REST_API_KEY ?? '',
  },

  naver: {
    mapClientId: process.env.NAVER_MAP_CLIENT_ID ?? '',
    mapClientSecret: process.env.NAVER_MAP_CLIENT_SECRET ?? '',
    // 구 NCP 콘솔 키면 'ncpClientId', 신규 AI·NAVER API 면 'ncpKeyId'.
    // 네이버가 2024 년부터 신규 발급은 ncpKeyId 로 이관됨.
    mapAuthParam: (process.env.NAVER_MAP_AUTH_PARAM ?? 'ncpKeyId') as
      | 'ncpKeyId'
      | 'ncpClientId',
  },

  security: {
    /** HSTS max-age (seconds). 기본 180d. 0 이면 HSTS 미적용 */
    hstsMaxAgeSec: toInt(process.env.HSTS_MAX_AGE_SEC, 60 * 60 * 24 * 180),
    /** IP 해시용 솔트 — 절대 커밋 금지 */
    ipHashSalt: process.env.IP_HASH_SALT ?? 'msnavi-default-salt-change-me',
    /** 글로벌 RPS 상한 (초당, windowMs 내부 기준) */
    globalRateLimit: toInt(process.env.RATE_LIMIT_GLOBAL, 120),
    externalApiRateLimit: toInt(process.env.RATE_LIMIT_EXTERNAL, 30),
    writeRateLimit: toInt(process.env.RATE_LIMIT_WRITE, 60),
  },

  admin: {
    /** 관리자 API 키. 32+ 랜덤 문자열 권장. 비어있으면 관리자 라우트 전부 비활성. */
    apiKey: process.env.ADMIN_API_KEY ?? '',
    /** 관리자 접근 허용 IP 화이트리스트 (콤마 구분). 비어있으면 IP 제한 없음. */
    allowIps: (process.env.ADMIN_ALLOW_IPS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
} as const;

export type Env = typeof env;
// 가볍게 검증
if (env.corsOrigins.length === 0) {
  console.warn('[env] CORS_ORIGINS 가 비어있습니다. 모든 origin 허용되지 않을 수 있습니다.');
}
