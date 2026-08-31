import { getServerUrl } from "./client"

export type SSEEvent = {
  type: string
  properties: Record<string, unknown>
}

function buildEventUrl(path = "/global/event"): string {
  const isDev = import.meta.env.DEV
  const base = isDev ? "" : (getServerUrl() || "")
  const dir = (() => {
    try { return localStorage.getItem("ganesha:directory") }
    catch { return null }
  })()
  const qs = dir ? `${path.includes("?") ? "&" : "?"}directory=${encodeURIComponent(dir)}` : ""
  return `${base}${path}${qs}`
}

function extractEvent(raw: unknown): SSEEvent | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>

  // Format 1: OpenCode GlobalEvent — { directory, payload: { id, type, properties } }
  if ("payload" in obj && obj.payload && typeof obj.payload === "object") {
    const p = obj.payload as Record<string, unknown>
    if (p.type && p.properties) {
      return { type: String(p.type), properties: p.properties as Record<string, unknown> }
    }
  }

  // Format 2: Already { type, properties }
  if ("type" in obj && "properties" in obj) {
    return { type: String(obj.type), properties: obj.properties as Record<string, unknown> }
  }

  // Format 3: { type, ...rest } (properties are top-level)
  if ("type" in obj) {
    const { type, ...rest } = obj
    return { type: String(type), properties: rest as Record<string, unknown> }
  }

  return null
}

/**
 * Subscribe to SSE events using fetch with custom headers.
 * EventSource cannot send Authorization / x-opencode-directory headers,
 * so we use fetch + ReadableStream instead.
 */
export function subscribeEvents(
  onEvent: (event: SSEEvent) => void,
  onError?: (err: unknown) => void
): { unsubscribe: () => void } {
  let cancelled = false
  let retryDelay = 1000
  let abortController: AbortController | null = null

  async function connect() {
    if (cancelled) return

    try {
      const url = buildEventUrl("/global/event")
      const dir = (() => {
        try { return localStorage.getItem("ganesha:directory") }
        catch { return null }
      })()

      // Get password from persisted connection (set by connection.ts)
      let password: string | null = null
      try {
        const stored = localStorage.getItem("ganesha:connection")
        if (stored) {
          const parsed = JSON.parse(stored)
          password = parsed.password || null
        }
      } catch { /* ignore */ }

      const headers: Record<string, string> = {
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache",
      }

      if (password) {
        headers["Authorization"] = `Basic ${btoa(`opencode:${password}`)}`
      }

      if (dir) {
        headers["x-opencode-directory"] = encodeURIComponent(dir)
      }

      abortController = new AbortController()

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error("No response body from SSE endpoint")
      }

      retryDelay = 1000
      console.debug("[SSE] connected via fetch")

      const reader = response.body.getReader()
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
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim()
            }
            if (line.startsWith("data:")) {
              data += line.slice(5).trim()
            }
          }

          if (data) {
            try {
              const raw = JSON.parse(data)
              const ev = extractEvent(raw) || { type: eventType, properties: raw as Record<string, unknown> }
              // Prefer payload.type over SSE event: header if present
              if (ev && raw && typeof raw === "object" && (raw as Record<string, unknown>).payload) {
                // extractEvent already unwrapped payload.type — keep it
              } else if (eventType !== "message") {
                ev.type = eventType
              }
              console.debug("[SSE]", ev.type, ev.properties)
              onEvent(ev)
            } catch {
              console.debug("[SSE] parse error:", data?.substring?.(0, 200))
            }
          }
        }
      }
    } catch (err) {
      if (cancelled) return
      // AbortError from unsubscribe is not an error
      if (err instanceof DOMException && err.name === "AbortError") return
      console.error("[SSE] connection error:", err)
      onError?.(err)

      if (!cancelled) {
        setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 1.5, 10000)
      }
    }
  }

  connect()

  return {
    unsubscribe: () => {
      cancelled = true
      if (abortController) {
        abortController.abort()
        abortController = null
      }
    },
  }
}
