import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/validate';
import * as svc from '../services/ride.service';

export const startRideSchema = z.object({
  userId: z.number().int().positive().optional(),
  courseId: z.number().int().positive().optional(),
  segmentId: z.number().int().positive().optional(),
});

export const trackPointsSchema = z.object({
  points: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        speedKmh: z.number().min(0).max(200).optional(),
        altitudeM: z.number().optional(),
        recordedAt: z.string().datetime().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const endRideSchema = z.object({
  totalDistanceKm: z.number().min(0).optional(),
  avgSpeedKmh: z.number().min(0).max(200).optional(),
  maxSpeedKmh: z.number().min(0).max(200).optional(),
  movingTimeSec: z.number().int().min(0).optional(),
  stoppedTimeSec: z.number().int().min(0).optional(),
});

export const postStart = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof startRideSchema>;
  const session = await svc.startRide(body);
  res.status(201).json(session);
});

export const postTrack = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const body = req.body as z.infer<typeof trackPointsSchema>;
  const result = await svc.addTrackPoints(id, body.points);
  res.json(result);
});

export const postEnd = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const body = req.body as z.infer<typeof endRideSchema>;
  const session = await svc.endRide(id, body);
  res.json(session);
});

export const getRideById = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = await svc.getRide(id);
  res.json(data);
});
