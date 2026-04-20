import { useQuery } from '@tanstack/react-query';
import { coursesApi, CourseSegment } from '../services/api';

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: coursesApi.list,
  });
}

export function useCourseSegments(courseId: number | null) {
  return useQuery<CourseSegment[]>({
    queryKey: ['course-segments', courseId],
    queryFn: () => coursesApi.segments(courseId as number),
    enabled: !!courseId,
  });
}

export function useCoursePois(courseId: number | null, type?: string) {
  return useQuery({
    queryKey: ['course-pois', courseId, type ?? null],
    queryFn: () => coursesApi.pois(courseId as number, type),
    enabled: !!courseId,
  });
}
