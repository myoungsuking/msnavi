import { create } from 'zustand';

export interface CurrentLocation {
  lat: number;
  lng: number;
  speedKmh?: number;
  heading?: number;
}

interface NavigationState {
  selectedCourseId: number | null;
  currentLocation: CurrentLocation | null;
  snappedLocation: { lat: number; lng: number } | null;
  remainingDistanceKm: number;
  estimatedDurationMin: number | null;
  estimatedArrivalAt: string | null;
  offRoute: boolean;
  nextPoiName: string | null;
  nextPoiDistanceKm: number | null;

  setCourseId: (id: number | null) => void;
  setCurrentLocation: (loc: CurrentLocation | null) => void;
  setProgress: (p: {
    snapped: { lat: number; lng: number } | null;
    remainingDistanceKm: number;
    estimatedDurationMin: number | null;
    estimatedArrivalAt: string | null;
    offRoute: boolean;
    nextPoiName: string | null;
    nextPoiDistanceKm: number | null;
  }) => void;
  reset: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  selectedCourseId: null,
  currentLocation: null,
  snappedLocation: null,
  remainingDistanceKm: 0,
  estimatedDurationMin: null,
  estimatedArrivalAt: null,
  offRoute: false,
  nextPoiName: null,
  nextPoiDistanceKm: null,

  setCourseId: (id) => set({ selectedCourseId: id }),
  setCurrentLocation: (loc) => set({ currentLocation: loc }),
  setProgress: (p) =>
    set({
      snappedLocation: p.snapped,
      remainingDistanceKm: p.remainingDistanceKm,
      estimatedDurationMin: p.estimatedDurationMin,
      estimatedArrivalAt: p.estimatedArrivalAt,
      offRoute: p.offRoute,
      nextPoiName: p.nextPoiName,
      nextPoiDistanceKm: p.nextPoiDistanceKm,
    }),
  reset: () =>
    set({
      selectedCourseId: null,
      currentLocation: null,
      snappedLocation: null,
      remainingDistanceKm: 0,
      estimatedDurationMin: null,
      estimatedArrivalAt: null,
      offRoute: false,
      nextPoiName: null,
      nextPoiDistanceKm: null,
    }),
}));
