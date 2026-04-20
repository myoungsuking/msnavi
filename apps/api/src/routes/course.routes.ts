import { Router } from 'express';
import * as ctrl from '../controllers/course.controller';

const router = Router();

router.get('/', ctrl.listCourses);
router.get('/:id', ctrl.getCourse);
router.get('/:id/segments', ctrl.getCourseSegments);
router.get('/:id/pois', ctrl.getCoursePois);

export default router;
