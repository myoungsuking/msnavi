import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { getNearby, nearbyQuerySchema } from '../controllers/nearby.controller';

const router = Router();

router.get('/', validate(nearbyQuerySchema, 'query'), getNearby);

export default router;
