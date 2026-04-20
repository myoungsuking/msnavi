import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/validate';
import { computeProgress } from '../services/navigation.service';

export const progressBodySchema = z.object({
  courseId: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(200).optional(),
  offRouteThresholdM: z.number().int().min(10).max(1000).optional(),
});

export type ProgressBody = z.infer<typeof progressBodySchema>;

export const postProgress = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ProgressBody;
  const result = await computeProgress(body);
  res.json(result);
});
