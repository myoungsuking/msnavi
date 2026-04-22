import { Router } from 'express';
import { adminAuth } from '../middlewares/admin-auth';
import { adminLimiter } from '../middlewares/rate-limit';
import { query } from '../db/pool';
import { env } from '../config/env';

/**
 * 관리자 전용 라우트. 외부 공개 서비스임에도 운영자 도구(데이터 통계·캐시 플러시 등)
 * 가 필요한 경우에 한해 X-Admin-Key 헤더로 인증하고 접근 IP 를 화이트리스트 제한한다.
 *
 * 본 라우트는 기본 관리자 1인 단독 운영을 가정한 최소 구성이며,
 * 추후 멀티 관리자가 필요해지면 OAuth/세션 기반으로 교체한다.
 */

const router = Router();

router.use(adminLimiter, adminAuth);

router.get('/ping', (_req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    node: process.versions.node,
    env: env.nodeEnv,
  });
});

router.get('/stats', async (_req, res) => {
  const [courseCount, poiCount, rideCount] = await Promise.all([
    query<{ c: string }>('SELECT COUNT(*)::text AS c FROM course'),
    query<{ c: string }>('SELECT COUNT(*)::text AS c FROM poi'),
    query<{ c: string }>('SELECT COUNT(*)::text AS c FROM ride_session'),
  ]);
  res.json({
    course: Number(courseCount.rows[0]?.c ?? 0),
    poi: Number(poiCount.rows[0]?.c ?? 0),
    ride: Number(rideCount.rows[0]?.c ?? 0),
  });
});

export default router;
