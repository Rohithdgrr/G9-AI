import { create } from "zustand"
import { getClient } from "../sdk/client"
import type { Part, Message, TextPart } from "@opencode-ai/sdk/client"

export type { Part, Message }

export interface MessageWithParts {
  info: Message
  parts: Part[]
}

interface StreamState { active: boolean; abortController: AbortController | null }

interface MessageState {
  messages: Map<string, MessageWithParts[]>
  streaming: Map<string, StreamState>
  loadMessages: (sessionId: string, limit?: number) => Promise<void>
  sendMessage: (sessionId: string, text: string) => Promise<void>
  abortMessage: (sessionId: string) => Promise<void>
  upsertPart: (part: Part) => void
  upsertMessage: (info: Message) => void
  mergeTextDelta: (part: Part, delta: string) => void
  removePart: (sessionID: string, messageID: string, partID: string) => void
  setStreaming: (sessionId: string, active: boolean) => void
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: new Map(),
  streaming: new Map(),

  loadMessages: async (sessionId: string, limit?: number) => {
    try {
      const client = getClient()
      const result = await client.session.messages({ path: { id: sessionId }, query: limit ? { limit } : undefined })
      const data = result.data as Array<{ info: Message; parts: Part[] }> | undefined
      const messages = (data || []) as MessageWithParts[]
      set((state) => {
        const m = new Map(state.messages)
        m.set(sessionId, messages)
        return { messages: m }
      })
    } catch { /* empty */ }
  },

  sendMessage: async (sessionId: string, text: string) => {
    const ac = new AbortController()
    // include selected model if set
    let model: { providerID: string; modelID: string } | undefined
    try {
      const raw = localStorage.getItem("ganesha:model")
      if (raw) model = JSON.parse(raw)
    } catch {}
    set((s) => {
      const ns = new Map(s.streaming); ns.set(sessionId, { active: true, abortController: ac })
      const nm = new Map(s.messages)
      const ex = nm.get(sessionId) || []
      nm.set(sessionId, [...ex, {
        info: { id: `user-${Date.now()}`, sessionID: sessionId, role: "user", time: { created: Date.now() }, agent: "build", model: { providerID: model?.providerID || "", modelID: model?.modelID || "" } } as Message,
        parts: [{ type: "text", id: `part-${Date.now()}`, sessionID: sessionId, messageID: `user-${Date.now()}`, text } as unknown as Part],
      }])
      return { streaming: ns, messages: nm }
    })
    try {
      const client = getClient()
      await client.session.promptAsync({ path: { id: sessionId }, body: { parts: [{ type: "text", text }], ...(model ? { model } : {}) } })
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") console.error("sendMessage:", err)
      get().loadMessages(sessionId)
    }
  },

  abortMessage: async (sessionId: string) => {
    try { const c = getClient(); await c.session.abort({ path: { id: sessionId } }) } catch { /* ignore */ }
    const stream = get().streaming.get(sessionId)
    stream?.abortController?.abort()
    set((s) => { const ns = new Map(s.streaming); ns.set(sessionId, { active: false, abortController: null }); return { streaming: ns } })
  },

  setStreaming: (sessionId: string, active: boolean) => {
    set((s) => { const ns = new Map(s.streaming); const cur = ns.get(sessionId); ns.set(sessionId, { active, abortController: active ? (cur?.abortController || null) : null }); return { streaming: ns } })
  },

  upsertPart: (part: Part) => {
    const sessionID = (part as { sessionID: string }).sessionID
    const messageID = (part as { messageID: string }).messageID
    if (!sessionID || !messageID) return
    set((s) => {
      const nm = new Map(s.messages)
      const list = nm.get(sessionID) || []
      const idx = list.findIndex((m) => m.info.id === messageID)
      if (idx >= 0) {
        const msg = list[idx]
        const pIdx = msg.parts.findIndex((p) => (p as { id: string }).id === (part as { id: string }).id)
        const newParts = [...msg.parts]
        if (pIdx >= 0) newParts[pIdx] = part as Part
        else newParts.push(part as Part)
        const newList = [...list]
        newList[idx] = { ...msg, parts: newParts }
        nm.set(sessionID, newList)
      } else {
        // New message for this part — try to find or create
        // Fallback: append to last assistant message or create new
        const last = list[list.length - 1]
        if (last && last.info.role === "assistant" && last.info.id === messageID) {
          const newParts = [...last.parts, part]
          const newList = [...list.slice(0, -1), { ...last, parts: newParts }]
          nm.set(sessionID, newList)
        } else {
          // Create placeholder message — will be replaced by message.updated
          nm.set(sessionID, [...list, {
            info: { id: messageID, sessionID, role: "assistant", time: { created: Date.now() }, parentID: "", modelID: "", providerID: "", mode: "build", path: { cwd: "", root: "" }, cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } } as Message,
            parts: [part],
          }])
        }
      }
      return { messages: nm }
    })
  },

  upsertMessage: (info: Message) => {
    const sessionID = (info as { sessionID: string }).sessionID
    if (!sessionID) return
    set((s) => {
      const nm = new Map(s.messages)
      const list = nm.get(sessionID) || []
      const idx = list.findIndex((m) => m.info.id === info.id)
      if (idx >= 0) {
        const newList = [...list]
        newList[idx] = { ...newList[idx], info }
        nm.set(sessionID, newList)
      } else {
        nm.set(sessionID, [...list, { info, parts: [] }])
      }
      return { messages: nm }
    })
  },

  mergeTextDelta: (part: Part, delta: string) => {
    const sessionID = (part as { sessionID: string }).sessionID
    const messageID = (part as { messageID: string }).messageID
    const partID = (part as { id: string }).id
    if (!sessionID || !partID) return
    set((s) => {
      const nm = new Map(s.messages)
      const list = nm.get(sessionID) || []
      const mIdx = list.findIndex((m) => m.info.id === messageID)
      if (mIdx >= 0) {
        const msg = list[mIdx]
        const pIdx = msg.parts.findIndex((p) => (p as { id: string }).id === partID)
        if (pIdx >= 0) {
          const existing = msg.parts[pIdx] as TextPart
          const updated = { ...existing, text: (existing.text || "") + delta } as Part
          const newParts = [...msg.parts]; newParts[pIdx] = updated
          const newList = [...list]; newList[mIdx] = { ...msg, parts: newParts }
          nm.set(sessionID, newList)
        } else {
          // Part not yet inserted — insert with delta
          const newPart = { ...part, text: delta } as Part
          const newParts = [...msg.parts, newPart]
          const newList = [...list]; newList[mIdx] = { ...msg, parts: newParts }
          nm.set(sessionID, newList)
        }
      } else {
        // No message yet — create
        const newPart = { ...part, text: delta } as Part
        nm.set(sessionID, [...list, {
          info: { id: messageID, sessionID, role: "assistant", time: { created: Date.now() }, parentID: "", modelID: "", providerID: "", mode: "build", path: { cwd: "", root: "" }, cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } } as Message,
          parts: [newPart],
        }])
      }
      return { messages: nm }
    })
  },

  removePart: (sessionID: string, messageID: string, partID: string) => {
    set((s) => {
      const nm = new Map(s.messages)
      const list = nm.get(sessionID) || []
      const mIdx = list.findIndex((m) => m.info.id === messageID)
      if (mIdx >= 0) {
        const msg = list[mIdx]
        const newParts = msg.parts.filter((p) => (p as { id: string }).id !== partID)
        const newList = [...list]; newList[mIdx] = { ...msg, parts: newParts }
        nm.set(sessionID, newList)
      }
      return { messages: nm }
    })
  },
}))
