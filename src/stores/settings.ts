import { create } from "zustand"
import { getClient } from "../sdk/client"

type Theme = "dark" | "light" | "system"

interface SettingsState {
  theme: Theme
  fontSize: number // 12-16
  density: "comfortable" | "compact"
  selectedModel: { providerID: string; modelID: string } | null
  providers: { providerID: string; modelID: string; name: string }[]
  setTheme: (t: Theme) => void
  setFontSize: (n: number) => void
  setDensity: (d: "comfortable" | "compact") => void
  setModel: (m: { providerID: string; modelID: string } | null) => void
  loadProviders: () => Promise<void>
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const isDark = theme === "dark" || (theme === "system" && prefersDark)
  root.classList.toggle("dark", isDark)
  root.classList.toggle("light", !isDark)
  localStorage.setItem("ganesha:theme", theme)
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: (localStorage.getItem("ganesha:theme") as Theme) || "dark",
  fontSize: Number(localStorage.getItem("ganesha:fontSize") || 13),
  density: (localStorage.getItem("ganesha:density") as "comfortable" | "compact") || "comfortable",
  selectedModel: JSON.parse(localStorage.getItem("ganesha:model") || "null"),
  providers: [],

  setTheme: (theme: Theme) => {
    applyTheme(theme)
    localStorage.setItem("ganesha:theme", theme)
    set({ theme })
  },
  setFontSize: (n: number) => {
    const v = Math.min(16, Math.max(12, n))
    document.documentElement.style.fontSize = `${v}px`
    localStorage.setItem("ganesha:fontSize", String(v))
    set({ fontSize: v })
  },
  setDensity: (d) => {
    localStorage.setItem("ganesha:density", d)
    set({ density: d })
  },
  setModel: (m) => {
    if (m) localStorage.setItem("ganesha:model", JSON.stringify(m))
    else localStorage.removeItem("ganesha:model")
    set({ selectedModel: m })
  },
  loadProviders: async () => {
    try {
      const c = getClient()
      // config.providers returns { providers: Provider[], default: Record<string,string> }
      const res = await c.config.providers()
      const data = res.data as { providers?: unknown[]; default?: Record<string, string> } | unknown[]
      const list: { providerID: string; modelID: string; name: string }[] = []
      if (Array.isArray(data)) {
        // fallback: array of providers?
      } else if (data && typeof data === "object" && "providers" in data) {
        const providers = (data as { providers: Array<{ id: string; models?: Array<{ id: string; name?: string }> } | string> }).providers || []
        for (const p of providers as Array<{ id: string; models?: Array<{ id: string; name?: string }> } | string>) {
          if (typeof p === "string") continue
          const pid = p.id
          for (const m of p.models || []) {
            const mid = typeof m === "string" ? m : m.id
            const name = typeof m === "string" ? m : m.name || m.id
            list.push({ providerID: pid, modelID: mid, name: `${pid}/${name}` })
          }
        }
      }
      // Fallback via provider.list + config direct fetch
      if (list.length === 0) {
        try {
          const pRes = await c.provider.list()
          const pData = pRes.data as { all?: Array<{ id: string }>; default?: Record<string, string> } | unknown
          if (pData && typeof pData === "object" && "all" in pData) {
            for (const pr of (pData as { all: Array<{ id: string }> }).all || []) {
              list.push({ providerID: pr.id, modelID: "default", name: pr.id })
            }
          }
        } catch {}
      }
      set({ providers: list })
    } catch {}
  },
}))

// init theme on load
try { applyTheme((localStorage.getItem("ganesha:theme") as Theme) || "dark") } catch {}
