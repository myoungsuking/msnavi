import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/validate';
import { searchNearby } from '../services/nearby.service';

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  type: z.string().min(1).optional(),
  radius: z.coerce.number().int().min(50).max(20_000).optional(),
  source: z.enum(['db', 'kakao', 'auto']).optional(),
});

export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

export const getNearby = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as NearbyQuery;
  const items = await searchNearby({
    lat: Number(q.lat),
    lng: Number(q.lng),
    type: q.type,
    radius: q.radius,
    source: q.source,
  });
  res.json({ items });
});
