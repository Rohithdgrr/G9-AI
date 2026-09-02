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
      const serverMessages = (data || []) as MessageWithParts[]
      set((state) => {
        const m = new Map(state.messages)
        const wasStreaming = state.streaming.get(sessionId)?.active
        if (wasStreaming) {
          // Merge guard: don't clobber in-flight SSE text that hasn't been persisted yet.
          const local = state.messages.get(sessionId) || []
          const serverById = new Map(serverMessages.map((sm) => [sm.info.id, sm]))
          const merged: MessageWithParts[] = serverMessages.map((sm) => {
            const lm = local.find((x) => x.info.id === sm.info.id)
            if (!lm) return sm
            // Merge parts: keep longer text (local SSE may be ahead of DB)
            const serverPartsById = new Map(sm.parts.map((p) => [(p as { id: string }).id, p]))
            const mergedParts: Part[] = sm.parts.map((sp) => {
              const lid = (sp as { id: string }).id
              const lp = lm.parts.find((p) => (p as { id: string }).id === lid) as TextPart | undefined
              if (lp && sp.type === "text" && lp.type === "text") {
                const lt = (lp as TextPart).text || ""
                const st = (sp as TextPart).text || ""
                if (lt.length > st.length) return lp as Part
              }
              return sp
            })
            // Preserve local parts not yet on server (new tokens)
            for (const lp of lm.parts) {
              const lid2 = (lp as { id: string }).id
              if (!serverPartsById.has(lid2)) mergedParts.push(lp)
            }
            return { info: sm.info, parts: mergedParts }
          })
          // Preserve local-only messages (optimistic user message before server ack)
          for (const lm of local) {
            if (!serverById.has(lm.info.id)) merged.push(lm)
          }
          m.set(sessionId, merged)
        } else {
          m.set(sessionId, serverMessages)
        }
        return { messages: m }
      })
    } catch { /* empty */ }
  },

  sendMessage: async (sessionId: string, text: string) => {
    const ac = new AbortController()
    // include selected model if set — default to free model so any API key works without billing
    let model: { providerID: string; modelID: string } | undefined
    try {
      const raw = localStorage.getItem("ganesha:model")
      if (raw) model = JSON.parse(raw)
      if (!model?.providerID || !model?.modelID) model = { providerID: "opencode", modelID: "mimo-v2.5-free" }
    } catch { model = { providerID: "opencode", modelID: "mimo-v2.5-free" } }
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
        const pid = (part as { id: string }).id
        const pIdx = msg.parts.findIndex((p) => (p as { id: string }).id === pid)
        const newParts = [...msg.parts]
        if (pIdx >= 0) newParts[pIdx] = part as Part
        else newParts.push(part as Part)
        const newList = [...list]
        newList[idx] = { ...msg, parts: newParts }
        nm.set(sessionID, newList)
      } else {
        // Message not yet in store — create placeholder
        // This happens when part.updated arrives before message.updated
        nm.set(sessionID, [...list, {
          info: {
            id: messageID, sessionID, role: "assistant",
            time: { created: Date.now() },
            parentID: "", agent: "", model: { providerID: "", modelID: "" },
            modelID: "", providerID: "", mode: "build",
            path: { cwd: "", root: "" },
            cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          } as Message,
          parts: [part],
        }])
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
