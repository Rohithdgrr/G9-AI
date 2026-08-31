import { getClient } from "./client"

export type SSEEvent = {
  type: string
  properties: Record<string, unknown>
}

export function subscribeEvents(
  onEvent: (event: SSEEvent) => void,
  onError?: (err: unknown) => void
): { unsubscribe: () => void } {
  let cancelled = false
  let retryDelay = 1000

  async function loop() {
    while (!cancelled) {
      try {
        const client = getClient()
        const stream = await client.global.event()
        // SDK returns ServerSentEventsResult with stream async iterable
        const anyStream = stream as unknown as { stream: AsyncIterable<SSEEvent> }
        if (anyStream.stream && typeof anyStream.stream[Symbol.asyncIterator] === "function") {
          for await (const event of anyStream.stream) {
            if (cancelled) break
            retryDelay = 1000
            onEvent(event as SSEEvent)
          }
        } else {
          // Fallback: try raw SSE via fetch
          await fetchSSE(onEvent)
        }
      } catch (err) {
        if (cancelled) break
        onError?.(err)
        await new Promise((r) => setTimeout(r, retryDelay))
        retryDelay = Math.min(retryDelay * 1.5, 10000)
      }
    }
  }

  async function fetchSSE(cb: (e: SSEEvent) => void) {
    const base = import.meta.env.DEV ? "" : (await import("./client")).getServerUrl() || ""
    const url = base ? `${base}/global/event` : `/global/event`
    const res = await fetch(url, { headers: { Accept: "text/event-stream" } })
    if (!res.body) throw new Error("No SSE body")
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    while (!cancelled) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop() || ""
      for (const chunk of parts) {
        const lines = chunk.split("\n")
        let eventType = "message"
        let data = ""
        for (const line of lines) {
          if (line.startsWith("event:")) eventType = line.slice(6).trim()
          if (line.startsWith("data:")) data += line.slice(5).trim()
        }
        if (data) {
          try {
            const json = JSON.parse(data)
            cb({ type: eventType, properties: json } as SSEEvent)
          } catch {
            cb({ type: eventType, properties: { data } } as SSEEvent)
          }
        }
      }
    }
  }

  loop()
  return { unsubscribe: () => { cancelled = true } }
}
