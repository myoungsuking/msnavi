import Redis from 'ioredis';
import { env } from '../config/env';

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.redis.enabled) return null;
  if (client) return client;
  client = new Redis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });
  client.on('error', (err: Error) => {
    console.warn('[redis] error:', err.message);
  });
  client.connect().catch((err: Error) => {
    console.warn('[redis] connect failed, cache disabled:', err.message);
    client = null;
  });
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const v = await r.get(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSec: number = env.redis.ttlSec,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.setex(key, ttlSec, JSON.stringify(value));
  } catch {
    // 캐시 실패는 무시
  }
}

export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(key);
  } catch {
    // 무시
  }
}

export async function pingRedis(): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  try {
    const pong = await r.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
