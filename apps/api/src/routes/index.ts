import { Router } from 'express';
import courseRoutes from './course.routes';
import nearbyRoutes from './nearby.routes';
import navigationRoutes from './navigation.routes';
import rideRoutes from './ride.routes';
import { pingDb } from '../db/pool';
import { pingRedis } from '../db/redis';
import { env } from '../config/env';

const router = Router();

router.get('/health', async (_req, res) => {
  const [db, redis] = await Promise.all([pingDb(), pingRedis()]);
  res.json({
    ok: true,
    env: env.nodeEnv,
    db,
    redis: env.redis.enabled ? redis : 'disabled',
    now: new Date().toISOString(),
  });
});

router.use('/courses', courseRoutes);
router.use('/nearby', nearbyRoutes);
router.use('/navigation', navigationRoutes);
router.use('/rides', rideRoutes);

export default router;
