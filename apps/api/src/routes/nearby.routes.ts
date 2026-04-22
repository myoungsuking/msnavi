import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { externalApiLimiter } from '../middlewares/rate-limit';
import { getNearby, nearbyQuerySchema } from '../controllers/nearby.controller';

const router = Router();

// 외부 Kakao API 비용이 큰 엔드포인트 — 별도 강한 레이트리밋
router.get('/', externalApiLimiter, validate(nearbyQuerySchema, 'query'), getNearby);

export default router;
