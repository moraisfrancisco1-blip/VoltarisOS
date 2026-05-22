import { create } from 'zustand';
import type { Lang } from './i18n';

export type ViewMode = 'operator' | 'investor';

interface DashboardState {
  lang: Lang;
  mode: ViewMode;
  riskLevel: number;
  autoExecute: boolean;
  batteryCapacity: number;
  consumptionProfile: number;
  solarPanels: number;
  setLang: (lang: Lang) => void;
  setMode: (mode: ViewMode) => void;
  setRiskLevel: (level: number) => void;
  setAutoExecute: (auto: boolean) => void;
  setBatteryCapacity: (val: number) => void;
  setConsumptionProfile: (val: number) => void;
  setSolarPanels: (val: number) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  lang: 'pt',
  mode: 'operator',
  riskLevel: 30,
  autoExecute: false,
  batteryCapacity: 10,
  consumptionProfile: 50,
  solarPanels: 12,
  setLang: (lang) => set({ lang }),
  setMode: (mode) => set({ mode }),
  setRiskLevel: (riskLevel) => set({ riskLevel }),
  setAutoExecute: (autoExecute) => set({ autoExecute }),
  setBatteryCapacity: (batteryCapacity) => set({ batteryCapacity }),
  setConsumptionProfile: (consumptionProfile) => set({ consumptionProfile }),
  setSolarPanels: (solarPanels) => set({ solarPanels }),
}));
