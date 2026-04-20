import { create } from 'zustand';

interface SettingsState {
  gpsIntervalMs: number;
  batterySaverEnabled: boolean;
  distanceUnit: 'km' | 'mi';
  speedUnit: 'kmh' | 'mph';

  setGpsInterval: (ms: number) => void;
  setBatterySaver: (enabled: boolean) => void;
  setDistanceUnit: (u: 'km' | 'mi') => void;
  setSpeedUnit: (u: 'kmh' | 'mph') => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  gpsIntervalMs: 2000,
  batterySaverEnabled: false,
  distanceUnit: 'km',
  speedUnit: 'kmh',

  setGpsInterval: (ms) => set({ gpsIntervalMs: ms }),
  setBatterySaver: (enabled) =>
    set({ batterySaverEnabled: enabled, gpsIntervalMs: enabled ? 5000 : 2000 }),
  setDistanceUnit: (u) => set({ distanceUnit: u }),
  setSpeedUnit: (u) => set({ speedUnit: u }),
}));
