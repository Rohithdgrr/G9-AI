import { getServerUrl } from "./client"
import { useConnectionStore } from "../stores/connection"

export type SSEEvent = { type: string; properties: Record<string, unknown> }

const MAX_SSE_RETRIES = 15
const BASE_RETRY_DELAY = 1000

function buildEventUrl(path = "/global/event"): string {
  const isDev = import.meta.env.DEV
  const base = isDev ? "" : (getServerUrl() || "")
  const dir = (() => { try { return localStorage.getItem("ganesha:directory") } catch { return null } })()
  // Send directory as query param as fallback (server also reads header)
  const qs = dir ? `${path.includes("?") ? "&" : "?"}directory=${encodeURIComponent(dir)}` : ""
  return `${base}${path}${qs}`
}

function extractEvent(raw: unknown): SSEEvent | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>

  // OpenCode GlobalEvent — { directory, payload: { id, type, properties } }
  if ("payload" in obj && obj.payload && typeof obj.payload === "object") {
    const p = obj.payload as Record<string, unknown>
    if (p.type && p.properties) {
      return { type: String(p.type), properties: p.properties as Record<string, unknown> }
    }
  }

  // Direct { type, properties }
  if ("type" in obj && "properties" in obj) {
    return { type: String(obj.type), properties: obj.properties as Record<string, unknown> }
  }

  // Fallback { type, ...rest }
  if ("type" in obj) {
    const { type, ...rest } = obj
    return { type: String(type), properties: rest as Record<string, unknown> }
  }

  return null
}

function getCredentials(): { directory: string | null; password: string | null } {
  const dir = (() => { try { return localStorage.getItem("ganesha:directory") } catch { return null } })()
  let password: string | null = null
  try {
    const stored = localStorage.getItem("ganesha:connection")
    if (stored) password = (JSON.parse(stored) as { password?: string }).password || null
  } catch { /* ignore */ }
  return { directory: dir, password }
}

/**
 * Fetch-based SSE — replaces EventSource which cannot send Authorization headers.
 * Works for all folders and both dev (Vite proxy) and Tauri prod.
 * Caps retries at MAX_SSE_RETRIES and surfaces errors to the connection store.
 */
export function subscribeEvents(
  onEvent: (event: SSEEvent) => void,
  onError?: (err: unknown) => void
): { unsubscribe: () => void; retryCount: () => number } {
  let cancelled = false
  let retryDelay = BASE_RETRY_DELAY
  let retryCount = 0
  let abortController: AbortController | null = null

  function getRetryDelay(): number {
    return Math.min(BASE_RETRY_DELAY * Math.pow(1.5, Math.min(retryCount, 10)), 30000)
  }

  async function connect() {
    if (cancelled) return

    const { directory, password } = getCredentials()
    const url = buildEventUrl("/global/event")

    const headers: Record<string, string> = {
      "Accept": "text/event-stream",
      "Cache-Control": "no-cache",
    }
    if (password) headers["Authorization"] = `Basic ${btoa(`opencode:${password}`)}`
    if (directory) headers["x-opencode-directory"] = encodeURIComponent(directory)

    // Debug without leaking full token
    console.debug("[SSE] connecting", { url, hasAuth: !!password, directory: directory || "(none)", retryCount })

    try {
      abortController = new AbortController()
      const res = await fetch(url, { method: "GET", headers, signal: abortController.signal })

      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        throw new Error(`SSE ${res.status} ${res.statusText}${errText ? ` — ${errText.slice(0, 200)}` : ""}`)
      }
      if (!res.body) throw new Error("No response body from SSE endpoint")

      // Reset retry state on successful connection
      retryCount = 0
      retryDelay = BASE_RETRY_DELAY
      useConnectionStore.getState().setSSERetryCount(0)
      useConnectionStore.getState().setSSELastError("")
      useConnectionStore.getState().addNotification("success", "SSE connected — streaming active")
      console.debug("[SSE] connected via fetch")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (!cancelled) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split("\n\n")
        buffer = chunks.pop() || ""

        for (const chunk of chunks) {
          const lines = chunk.split("\n")
          let eventType = "message"
          let data = ""
          for (const line of lines) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim()
            else if (line.startsWith("data:")) data += line.slice(5).trim()
          }
          if (!data) continue
          try {
            const raw = JSON.parse(data)
            let ev = extractEvent(raw)
            if (!ev) {
              // Raw fallback — emit every JSON as event so UI never misses
              ev = { type: eventType, properties: raw as Record<string, unknown> }
            } else if (!raw.payload && eventType !== "message") {
              // Prefer SSE event: header when payload absent
              ev.type = eventType
            }
            console.debug("[SSE]", ev.type, ev.properties)
            onEvent(ev)
          } catch {
            console.warn("[SSE] parse failed:", data.slice(0, 120))
          }
        }
      }
    } catch (err) {
      if (cancelled) return
      if (err instanceof DOMException && err.name === "AbortError") return

      const msg = err instanceof Error ? err.message : String(err)
      const isAuth = msg.includes("401") || msg.includes("403") || msg.includes("401") || msg.includes("Unauthorized")

      // Increment retry count and surface to store
      retryCount++
      useConnectionStore.getState().setSSERetryCount(retryCount)
      useConnectionStore.getState().setSSELastError(msg)
      console.error(`[SSE] error #${retryCount}:`, msg, isAuth ? "(check password / directory)" : "")

      // Cap retries and surface user-friendly error
      if (retryCount >= MAX_SSE_RETRIES) {
        useConnectionStore.getState().addNotification("error", `SSE streaming failed after ${MAX_SSE_RETRIES} retries. ${msg}`)
        useConnectionStore.getState().setSSELastError(`Failed after ${MAX_SSE_RETRIES} retries: ${msg}`)
        return
      }

      const delay = isAuth ? Math.min(getRetryDelay(), 15000) : getRetryDelay()
      console.debug(`[SSE] retry #${retryCount} in ${delay}ms`)
      await new Promise((r) => setTimeout(r, delay))
      if (!cancelled) connect()
    }
  }

  connect()

  return {
    unsubscribe: () => {
      cancelled = true
      if (abortController) { abortController.abort(); abortController = null }
    },
    retryCount: () => retryCount,
  }
}
