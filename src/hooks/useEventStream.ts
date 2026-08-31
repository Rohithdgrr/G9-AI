import { useEffect } from "react"
import { useMessageStore } from "../stores/message"
import { useSessionStore } from "../stores/session"
import { usePermissionStore } from "../stores/permission"
import { subscribeEvents } from "../sdk/events"
import type { Part, Message, Permission } from "@opencode-ai/sdk/client"

export function useEventStream(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const { unsubscribe } = subscribeEvents((event) => {
      const type = event.type
      const props = event.properties

      // message.part.updated — the main streaming event
      // OpenCode format: { sessionID, part: Part, time }
      // part.text = accumulated full text so far (NOT a delta)
      if (type === "message.part.updated") {
        const part = props.part as Part
        // SDK type is { part, delta? } without top-level sessionID; fall back to part.sessionID
        const sessionID = (props.sessionID as string) || (part as unknown as { sessionID: string })?.sessionID
        const delta = props.delta as string | undefined
        if (sessionID && part) {
          const partType = part.type
          if (partType === "text" && delta && !(part as { text: string }).text) {
            // Delta-only streaming fallback (some providers send delta without full text)
            useMessageStore.getState().mergeTextDelta(part, delta)
          } else {
            // Normal path: part.text is accumulated full text so far
            useMessageStore.getState().upsertPart(part)
          }

          // Nudge scroll on each update — only if near bottom
          requestAnimationFrame(() => {
            const el = document.querySelector("[data-testid='message-list']") as HTMLElement | null
            if (el) {
              const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160
              if (atBottom) el.scrollTop = el.scrollHeight
            }
          })
        }
      }

      // message.part.removed
      if (type === "message.part.removed") {
        const sessionID = props.sessionID as string
        const messageID = props.messageID as string
        const partID = props.partID as string
        if (sessionID && partID) {
          useMessageStore.getState().removePart(sessionID, messageID, partID)
        }
      }

      // message.updated — sync message metadata (role, model, cost, etc.)
      if (type === "message.updated") {
        const sessionID = props.sessionID as string
        const info = props.info as Message
        if (sessionID && info?.id) {
          useMessageStore.getState().upsertMessage(info)
        }
      }

      // permission.updated
      if (type === "permission.updated") {
        const perm = (props.permission || props) as Permission
        if (perm?.id) usePermissionStore.getState().add(perm)
      }

      // permission.replied
      if (type === "permission.replied") {
        const pid = (props.permissionID as string) || (props.id as string)
        if (pid) usePermissionStore.getState().remove(pid)
      }

      // session.status — busy/idle/retry
      if (type === "session.status") {
        const sessionID = props.sessionID as string
        const status = props.status as { type: string } | undefined
        if (sessionID && status) {
          if (status.type === "idle") useMessageStore.getState().setStreaming(sessionID, false)
          if (status.type === "busy") useMessageStore.getState().setStreaming(sessionID, true)
          if (status.type === "retry") useMessageStore.getState().setStreaming(sessionID, true)
        }
      }

      // session.idle
      if (type === "session.idle") {
        const sid = props.sessionID as string
        if (sid) useMessageStore.getState().setStreaming(sid, false)
      }

      // session.error
      if (type === "session.error") {
        const sid = (props.sessionID as string) || (props.sessionId as string)
        if (sid) {
          useMessageStore.getState().setStreaming(sid, false)
          // Reload messages to show error state
          useMessageStore.getState().loadMessages(sid).catch(() => {})
        }
      }

      // session events — refresh session list
      if (type === "session.created" || type === "session.updated" || type === "session.deleted") {
        useSessionStore.getState().loadSessions()
      }

      // step started/ended — refresh messages to get updated costs
      if (type === "session.next.step.ended" || type === "session.next.step.failed") {
        const sid = props.sessionID as string
        if (sid) useMessageStore.getState().loadMessages(sid).catch(() => {})
      }
    })

    return () => {
      unsubscribe()
    }
  }, [enabled])
}
