import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/validate';
import * as svc from '../services/course.service';
import { badRequest } from '../utils/http-error';

export const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

export const listCourses = asyncHandler(async (_req: Request, res: Response) => {
  const items = await svc.listCourses();
  res.json({ items });
});

export const getCourse = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw badRequest('id는 숫자여야 합니다.');
  const course = await svc.getCourse(id);
  res.json(course);
});

export const getCourseSegments = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const items = await svc.listCourseSegments(id);
  res.json({ items });
});

export const getCoursePois = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  // 공간 쿼리 기반 - 코스 polyline 50m 이내 POI. 경계 공유 POI 도 노출됨.
  const items = await svc.listPoisAlongCourse(id, type, 50);
  res.json({ items });
});
