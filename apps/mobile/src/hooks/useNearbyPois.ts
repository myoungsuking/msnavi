import { useQuery } from '@tanstack/react-query';
import { nearbyApi } from '../services/api';

export function useNearbyPois(params: {
  lat?: number;
  lng?: number;
  type?: string;
  radius?: number;
  source?: 'db' | 'kakao' | 'auto';
}) {
  const ready =
    typeof params.lat === 'number' && typeof params.lng === 'number';
  return useQuery({
    queryKey: ['nearby', params],
    queryFn: () =>
      nearbyApi.search({
        lat: params.lat as number,
        lng: params.lng as number,
        type: params.type,
        radius: params.radius,
        source: params.source,
      }),
    enabled: ready,
  });
}
