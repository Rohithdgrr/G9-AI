import { create } from "zustand"

type Tab = "general" | "connection" | "appearance" | "about"
interface UIState {
  settingsOpen: boolean
  settingsTab: Tab
  historyOpen: boolean
  setSettings: (v: boolean) => void
  setSettingsTab: (t: Tab) => void
  setHistory: (v: boolean) => void
}
export const useUIStore = create<UIState>((set) => ({
  settingsOpen: false,
  settingsTab: "general",
  historyOpen: false,
  setSettings: (v) => set({ settingsOpen: v }),
  setSettingsTab: (t) => set({ settingsTab: t }),
  setHistory: (v) => set({ historyOpen: v }),
}))
