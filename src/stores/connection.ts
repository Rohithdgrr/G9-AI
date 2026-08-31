import { create } from "zustand"
import { connect as sdkConnect, disconnect as sdkDisconnect, getClient } from "../sdk/client"

interface HealthInfo {
  healthy: boolean
  version: string
}

interface ConnectionState {
  status: "disconnected" | "connecting" | "connected" | "error"
  serverUrl: string | null
  health: HealthInfo | null
  error: string | null
  sseRetryCount: number
  sseLastError: string | null
  notifications: Array<{ id: string; type: "error" | "info" | "success"; text: string; time: number }>

  connect: (url: string, password?: string, directory?: string) => Promise<void>
  disconnect: () => void
  checkHealth: () => Promise<void>
  addNotification: (type: "error" | "info" | "success", text: string) => void
  removeNotification: (id: string) => void
  setSSERetryCount: (n: number) => void
  setSSELastError: (msg: string) => void
}

async function ensureServerViaTauri(): Promise<boolean> {
  // Try Tauri command if available (desktop), otherwise skip
  try {
    const tauri = await import("@tauri-apps/api/core").then((m) => m).catch(() => null) as unknown as { invoke: (cmd: string, args?: unknown) => Promise<unknown> } | null
    if (tauri?.invoke) {
      await tauri.invoke("ensure_opencode_server", { port: 4096 })
      return true
    }
  } catch {}
  return false
}

function getFriendlyError(err: unknown): string {
  if (err instanceof TypeError && err.message === "Failed to fetch") {
    return "Cannot reach OpenCode server. The app tried to auto-start it. If it still fails, run manually: opencode serve --port 4096 --cors http://localhost:1420"
  }
  if (err instanceof Error) {
    return err.message
  }
  return "Connection failed"
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: "disconnected",
  serverUrl: null,
  health: null,
  error: null,
  sseRetryCount: 0,
  sseLastError: "",
  notifications: [],

  addNotification: (type, text) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    set((s) => ({ notifications: [...s.notifications, { id, type, text, time: Date.now() }] }))
    // Auto-dismiss after 8s
    setTimeout(() => get().removeNotification(id), 8000)
  },
  removeNotification: (id) => {
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }))
  },
  setSSERetryCount: (n) => set({ sseRetryCount: n }),
  setSSELastError: (msg) => set({ sseLastError: msg }),

  connect: async (url, password, directory) => {
    const dirToUse = directory ?? (() => { try { return localStorage.getItem("ganesha:directory") } catch { return null } })()
    set({ status: "connecting", error: null })
    try {
      const isDev = import.meta.env.DEV
      const fetchUrl = isDev
        ? "/global/health"
        : url.replace(/\/$/, "") + "/global/health"

      // Health is global — do NOT send directory header here (server validates it and can 500 on bad path)
      const headers: Record<string, string> = {}
      if (password) {
        headers["Authorization"] = `Basic ${btoa(`opencode:${password}`)}`
      }

      let healthResp = await fetch(fetchUrl, { method: "GET", headers }).catch(async (e) => {
        // Auto-start via Tauri if first fetch fails (ECONNREFUSED)
        const started = await ensureServerViaTauri()
        if (started) {
          await new Promise((r) => setTimeout(r, 1200))
          return fetch(fetchUrl, { method: "GET", headers })
        }
        throw e
      })

      if (!healthResp.ok) {
        // One more auto-start attempt on 5xx / proxy error
        if (healthResp.status >= 500) {
          const started = await ensureServerViaTauri()
          if (started) {
            await new Promise((r) => setTimeout(r, 800))
            healthResp = await fetch(fetchUrl, { method: "GET", headers })
          }
        }
        if (!healthResp.ok) throw new Error(`Server returned ${healthResp.status}`)
      }

      const healthData = await healthResp.json()

      // Persist password + directory for SSE fetch (EventSource cannot send headers)
      try {
        if (password) {
          localStorage.setItem("ganesha:connection", JSON.stringify({ password }))
        } else {
          localStorage.removeItem("ganesha:connection")
        }
        if (dirToUse) localStorage.setItem("ganesha:directory", dirToUse)
      } catch { /* ignore */ }

      sdkConnect(url, password, dirToUse || undefined)
      const client = getClient()
      const result = await client.provider.list()

      if (result.data) {
        set({
          status: "connected",
          serverUrl: url,
          health: { healthy: true, version: healthData.version || "unknown" },
        })
      } else {
        set({ status: "error", error: "Server returned invalid response" })
      }
    } catch (err) {
      set({
        status: "error",
        error: getFriendlyError(err),
      })
    }
  },

  disconnect: () => {
    sdkDisconnect()
    try { localStorage.removeItem("ganesha:connection") } catch { /* ignore */ }
    set({
      status: "disconnected",
      serverUrl: null,
      health: null,
      error: null,
    })
  },

  checkHealth: async () => {
    try {
      const client = getClient()
      await client.provider.list()
      set((state) => ({
        health: { ...state.health!, healthy: true },
      }))
    } catch {
      set({ status: "error", error: "Lost connection to server" })
    }
  },
}))
