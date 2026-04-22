import { create } from 'zustand';

interface SettingsState {
  gpsIntervalMs: number;
  batterySaverEnabled: boolean;
  distanceUnit: 'km' | 'mi';
  speedUnit: 'kmh' | 'mph';
  voiceEnabled: boolean;

  setGpsInterval: (ms: number) => void;
  setBatterySaver: (enabled: boolean) => void;
  setDistanceUnit: (u: 'km' | 'mi') => void;
  setSpeedUnit: (u: 'kmh' | 'mph') => void;
  setVoiceEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  gpsIntervalMs: 2000,
  batterySaverEnabled: false,
  distanceUnit: 'km',
  speedUnit: 'kmh',
  voiceEnabled: true,

  setGpsInterval: (ms) => set({ gpsIntervalMs: ms }),
  setBatterySaver: (enabled) =>
    set({ batterySaverEnabled: enabled, gpsIntervalMs: enabled ? 5000 : 2000 }),
  setDistanceUnit: (u) => set({ distanceUnit: u }),
  setSpeedUnit: (u) => set({ speedUnit: u }),
  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
}));
