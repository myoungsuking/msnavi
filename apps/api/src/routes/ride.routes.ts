import { Router } from 'express';
import { validate } from '../middlewares/validate';
import {
  endRideSchema,
  getRideById,
  postEnd,
  postStart,
  postTrack,
  startRideSchema,
  trackPointsSchema,
} from '../controllers/ride.controller';

const router = Router();

router.post('/start', validate(startRideSchema, 'body'), postStart);
router.post('/:id/track', validate(trackPointsSchema, 'body'), postTrack);
router.post('/:id/end', validate(endRideSchema, 'body'), postEnd);
router.get('/:id', getRideById);

export default router;
