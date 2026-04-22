import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/validate';
import { computeProgress } from '../services/navigation.service';

export const progressBodySchema = z.object({
  courseId: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(200).optional(),
  /** 사용자 진행 방향 (0~360). 있으면 경로 tangent 와 비교하여 headingMismatch 계산. */
  headingDeg: z.number().min(0).max(360).optional(),
  offRouteThresholdM: z.number().int().min(10).max(1000).optional(),
  /** 직전 응답의 segmentIndex. 서버 윈도우 탐색 가속에 사용. */
  lastSegmentIndex: z.number().int().min(0).optional(),
});

export type ProgressBody = z.infer<typeof progressBodySchema>;

export const postProgress = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ProgressBody;
  const result = await computeProgress(body);
  res.json(result);
});
