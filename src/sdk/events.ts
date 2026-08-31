import { getClient, getServerUrl } from "./client"

export type SSEEvent = { type: string; properties: Record<string, unknown> }

function buildEventUrl(path = "/global/event"): string {
  const isDev = import.meta.env.DEV
  const base = isDev ? "" : (getServerUrl() || "")
  const dir = (() => { try { return localStorage.getItem("ganesha:directory") } catch { return null } })()
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

export function subscribeEvents(
  onEvent: (event: SSEEvent) => void,
  onError?: (err: unknown) => void
): { unsubscribe: () => void } {
  let cancelled = false
  let es: EventSource | null = null
  let retryDelay = 1000

  function connect() {
    if (cancelled) return
    if (typeof EventSource === "undefined") { fetchFallback(); return }

    try {
      const url = buildEventUrl("/global/event")
      es = new EventSource(url)

      es.onopen = () => {
        retryDelay = 1000
        console.debug("[SSE] connected")
      }

      es.onerror = () => {
        console.debug("[SSE] EventSource error, closing and retrying")
        if (es) { es.close(); es = null }
        if (!cancelled) setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 1.5, 10000)
        onError?.(new Error("EventSource error"))
      }

      // Generic message handler — fires for events without explicit listener
      es.onmessage = (e: MessageEvent) => {
        try {
          const raw = JSON.parse(e.data)
          const ev = extractEvent(raw)
          if (ev) {
            console.debug("[SSE]", ev.type, ev.properties)
            onEvent(ev)
          }
        } catch {
          console.debug("[SSE] parse error:", e.data?.substring?.(0, 200))
        }
      }

      // Named event listeners — OpenCode sends typed SSE events
      const namedEvents = [
        "message.part.updated",
        "message.part.removed",
        "message.updated",
        "message.removed",
        "permission.updated",
        "permission.replied",
        "session.status",
        "session.idle",
        "session.error",
        "session.created",
        "session.updated",
        "session.deleted",
        "session.next.step.started",
        "session.next.step.ended",
        "session.next.step.failed",
        "session.next.agent.switched",
        "session.next.model.switched",
      ]
      for (const t of namedEvents) {
        es.addEventListener(t, (e: MessageEvent) => {
          try {
            const raw = JSON.parse((e as MessageEvent).data)
            // Named event data may be the GlobalEvent or just the properties
            const ev = extractEvent(raw) || { type: t, properties: raw as Record<string, unknown> }
            // Override type to match the SSE event name (more reliable)
            ev.type = t
            console.debug("[SSE]", ev.type, ev.properties)
            onEvent(ev)
          } catch {
            console.debug("[SSE] named event parse error for", t)
          }
        })
      }
    } catch {
      if (!cancelled) { fetchFallback() }
    }
  }

  async function fetchFallback() {
    while (!cancelled) {
      try {
        const client = getClient()
        const stream = await client.global.event()
        const anyStream = stream as unknown as { stream: AsyncIterable<SSEEvent> }
        if (anyStream.stream && typeof anyStream.stream[Symbol.asyncIterator] === "function") {
          for await (const event of anyStream.stream) {
            if (cancelled) break
            retryDelay = 1000
            const ev = extractEvent(event) || event as SSEEvent
            console.debug("[SSE:SDK]", ev.type, ev.properties)
            onEvent(ev)
          }
        } else {
          await fetchRaw()
        }
      } catch (err) {
        if (cancelled) break
        onError?.(err)
        await new Promise((r) => setTimeout(r, retryDelay))
        retryDelay = Math.min(retryDelay * 1.5, 10000)
      }
    }
  }

  async function fetchRaw() {
    const url = buildEventUrl("/global/event")
    // fetch fallback can send directory via header as well
    const dir = (() => { try { return localStorage.getItem("ganesha:directory") } catch { return null } })()
    const headers: Record<string, string> = { Accept: "text/event-stream" }
    if (dir) headers["x-opencode-directory"] = encodeURIComponent(dir)
    const res = await fetch(url, { headers })
    if (!res.body) throw new Error("No SSE body")
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
          if (line.startsWith("data:")) data += line.slice(5).trim()
        }
        if (data) {
          try {
            const raw = JSON.parse(data)
            const ev = extractEvent(raw) || { type: eventType, properties: raw as Record<string, unknown> }
            ev.type = eventType
            console.debug("[SSE:raw]", ev.type, ev.properties)
            onEvent(ev)
          } catch {
            console.debug("[SSE:raw] parse error")
          }
        }
      }
    }
  }

  connect()

  return {
    unsubscribe: () => {
      cancelled = true
      if (es) { es.close(); es = null }
    },
  }
}
