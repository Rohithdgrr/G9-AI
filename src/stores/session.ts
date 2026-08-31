import { create } from "zustand"
import { getClient } from "../sdk/client"
import type { Session } from "@opencode-ai/sdk/client"

export type { Session }

interface SessionState {
  sessions: Session[]
  activeSessionId: string | null
  loading: boolean
  hasMore: boolean
  loadSessions: () => Promise<void>
  createSession: (title?: string) => Promise<Session>
  deleteSession: (id: string) => Promise<void>
  setActiveSession: (id: string) => void
  renameSession: (id: string, title: string) => Promise<void>
  forkSession: (id: string, messageID?: string) => Promise<Session>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  loading: false,
  hasMore: false,

  loadSessions: async () => {
    set({ loading: true })
    try {
      const client = getClient()
      const result = await client.session.list()
      const sessions = (result.data || []) as Session[]
      // Sort newest first by time.updated
      sessions.sort((a, b) => (b.time?.updated || 0) - (a.time?.updated || 0))
      set({ sessions, loading: false })
      if (sessions.length > 0 && !get().activeSessionId) set({ activeSessionId: sessions[0].id })
    } catch { set({ loading: false }) }
  },

  createSession: async (title?: string) => {
    const client = getClient()
    const result = await client.session.create({ body: { title } })
    const session = result.data as Session
    set((s) => ({ sessions: [session, ...s.sessions], activeSessionId: session.id }))
    return session
  },

  deleteSession: async (id: string) => {
    const client = getClient()
    await client.session.delete({ path: { id } })
    set((s) => {
      const sessions = s.sessions.filter((x) => x.id !== id)
      const activeSessionId = s.activeSessionId === id ? (sessions[0]?.id || null) : s.activeSessionId
      return { sessions, activeSessionId }
    })
  },

  setActiveSession: (id: string) => set({ activeSessionId: id }),

  renameSession: async (id: string, title: string) => {
    const client = getClient()
    await client.session.update({ path: { id }, body: { title } })
    set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, title } : x)) }))
  },

  forkSession: async (id: string, messageID?: string) => {
    const client = getClient()
    const result = await client.session.fork({ path: { id }, body: { messageID } })
    const forked = result.data as Session
    set((s) => ({ sessions: [forked, ...s.sessions], activeSessionId: forked.id }))
    return forked
  },
}))
