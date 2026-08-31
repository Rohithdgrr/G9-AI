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

  connect: (url: string, password?: string) => Promise<void>
  disconnect: () => void
  checkHealth: () => Promise<void>
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

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "disconnected",
  serverUrl: null,
  health: null,
  error: null,

  connect: async (url: string, password?: string) => {
    set({ status: "connecting", error: null })
    try {
      const isDev = import.meta.env.DEV
      const fetchUrl = isDev
        ? "/global/health"
        : url.replace(/\/$/, "") + "/global/health"

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

      sdkConnect(url, password)
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
