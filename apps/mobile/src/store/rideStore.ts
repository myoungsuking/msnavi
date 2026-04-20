import { create } from 'zustand';

interface RideState {
  rideId: number | null;
  startedAt: string | null;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  totalDistanceKm: number;
  movingTimeSec: number;
  stoppedTimeSec: number;

  startRide: (id: number) => void;
  endRide: () => void;
  updateStats: (partial: Partial<Omit<RideState, 'startRide' | 'endRide' | 'updateStats'>>) => void;
}

export const useRideStore = create<RideState>((set) => ({
  rideId: null,
  startedAt: null,
  avgSpeedKmh: 0,
  maxSpeedKmh: 0,
  totalDistanceKm: 0,
  movingTimeSec: 0,
  stoppedTimeSec: 0,

  startRide: (id) =>
    set({
      rideId: id,
      startedAt: new Date().toISOString(),
      avgSpeedKmh: 0,
      maxSpeedKmh: 0,
      totalDistanceKm: 0,
      movingTimeSec: 0,
      stoppedTimeSec: 0,
    }),
  endRide: () =>
    set({ rideId: null, startedAt: null }),
  updateStats: (partial) => set((s) => ({ ...s, ...partial })),
}));
