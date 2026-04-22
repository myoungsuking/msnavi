import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { writeLimiter } from '../middlewares/rate-limit';
import {
  endRideSchema,
  getList,
  getRideById,
  listRidesSchema,
  postEnd,
  postStart,
  postTrack,
  startRideSchema,
  trackPointsSchema,
} from '../controllers/ride.controller';

const router = Router();

router.get('/', validate(listRidesSchema, 'query'), getList);
router.post('/start', writeLimiter, validate(startRideSchema, 'body'), postStart);
router.post('/:id/track', writeLimiter, validate(trackPointsSchema, 'body'), postTrack);
router.post('/:id/end', writeLimiter, validate(endRideSchema, 'body'), postEnd);
router.get('/:id', getRideById);

export default router;
