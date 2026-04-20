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
} as const;

export type Env = typeof env;
// 가볍게 검증
if (env.corsOrigins.length === 0) {
  console.warn('[env] CORS_ORIGINS 가 비어있습니다. 모든 origin 허용되지 않을 수 있습니다.');
}
