import { create } from "zustand"
import { getClient } from "../sdk/client"
import type { Permission } from "@opencode-ai/sdk/client"

export type { Permission }

interface PermissionState {
  pending: Map<string, Permission> // permissionID -> permission
  add: (p: Permission) => void
  remove: (id: string) => void
  reply: (sessionID: string, permissionID: string, response: "once" | "always" | "reject") => Promise<void>
  clearSession: (sessionID: string) => void
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  pending: new Map(),

  add: (p: Permission) =>
    set((s) => {
      const m = new Map(s.pending)
      m.set(p.id, p)
      return { pending: m }
    }),

  remove: (id: string) =>
    set((s) => {
      const m = new Map(s.pending)
      m.delete(id)
      return { pending: m }
    }),

  reply: async (sessionID: string, permissionID: string, response: "once" | "always" | "reject") => {
    try {
      const client = getClient()
      await client.postSessionIdPermissionsPermissionId({
        path: { id: sessionID, permissionID },
        body: { response },
      })
    } catch {
      // For mock permissions or network errors, still clear locally
    } finally {
      get().remove(permissionID)
    }
  },

  clearSession: (sessionID: string) =>
    set((s) => {
      const m = new Map(s.pending)
      for (const [k, v] of m) if (v.sessionID === sessionID) m.delete(k)
      return { pending: m }
    }),
}))
