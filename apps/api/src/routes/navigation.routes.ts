import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { postProgress, progressBodySchema } from '../controllers/navigation.controller';

const router = Router();

router.post('/progress', validate(progressBodySchema, 'body'), postProgress);

export default router;
