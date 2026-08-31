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
  selectedModel: JSON.parse(localStorage.getItem("ganesha:model") || '{"providerID":"opencode","modelID":"mimo-v2.5-free"}'),
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
      const res = await c.config.providers()
      const data = res.data as { providers?: unknown[]; default?: Record<string, string> } | unknown[]
      const list: { providerID: string; modelID: string; name: string }[] = []
      if (Array.isArray(data)) {
        // ignore
      } else if (data && typeof data === "object" && "providers" in data) {
        const providers = (data as { providers: Array<{ id: string; models?: Array<{ id: string; name?: string; models?: unknown }> } | string> }).providers || []
        for (const p of providers as Array<{ id: string; models?: Array<{ id: string; name?: string }> } | string>) {
          if (typeof p === "string") continue
          const pid = p.id
          const models = (p as { models?: Array<{ id: string; name?: string } | string> }).models || []
          for (const m of models) {
            const mid = typeof m === "string" ? m : m.id
            const name = typeof m === "string" ? m : m.name || m.id
            list.push({ providerID: pid, modelID: mid, name: `${pid}/${name}` })
          }
        }
      }
      if (list.length === 0) {
        try {
          const pRes = await c.provider.list()
          const pData = pRes.data as { all?: Array<{ id: string; models?: Array<{ id: string; name?: string } | string> }>; default?: Record<string, string> } | unknown
          if (pData && typeof pData === "object" && "all" in pData) {
            const all = (pData as { all: Array<{ id: string; models?: Array<{ id: string; name?: string } | string> }> }).all || []
            for (const pr of all) {
              const models = (pr as { models?: Array<{ id: string; name?: string } | string> }).models || []
              if (models.length) {
                for (const m of models) {
                  const mid = typeof m === "string" ? m : m.id
                  const name = typeof m === "string" ? m : m.name || m.id
                  list.push({ providerID: pr.id, modelID: mid, name: `${pr.id}/${name}` })
                }
              } else {
                list.push({ providerID: pr.id, modelID: "default", name: pr.id })
              }
            }
          }
        } catch {}
      }
      // Also try direct fetch for model list
      if (list.length === 0) {
        try {
          const base = (() => { try { return localStorage.getItem("ganesha:directory") } catch { return null } })()
          const headers: Record<string, string> = {}
          if (base) headers["x-opencode-directory"] = encodeURIComponent(base)
          const r = await fetch("/config/providers", { headers })
          if (r.ok) {
            const j = await r.json() as { providers?: Array<{ id: string; models?: Array<{ id: string; name?: string } | string> }> }
            for (const p of j.providers || []) {
              for (const m of p.models || []) {
                const mid = typeof m === "string" ? m : m.id
                const name = typeof m === "string" ? m : m.name || m.id
                list.push({ providerID: p.id, modelID: mid, name: `${p.id}/${name}` })
              }
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
