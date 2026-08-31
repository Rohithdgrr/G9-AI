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
      const props = event.properties as Record<string, unknown>

      if (type === "message.part.updated") {
        const part = (props.part as Part) || (props as unknown as Part)
        const delta = props.delta as string | undefined
        if (part && part.type === "text" && delta) {
          useMessageStore.getState().mergeTextDelta(part as Part, delta)
        } else if (part) {
          useMessageStore.getState().upsertPart(part as Part)
        }
      }

      if (type === "message.part.removed") {
        const sessionID = props.sessionID as string
        const messageID = props.messageID as string
        const partID = props.partID as string
        if (sessionID && partID) useMessageStore.getState().removePart(sessionID, messageID, partID)
      }

      if (type === "message.updated") {
        const info = (props.info as Message) || (props as unknown as Message)
        if (info?.id && (info as unknown as Message).sessionID) {
          useMessageStore.getState().upsertMessage(info as Message)
        }
      }

      if (type === "permission.updated") {
        const perm = (props as unknown as Permission) || (props.permission as Permission)
        if (perm?.id) usePermissionStore.getState().add(perm)
      }

      if (type === "permission.replied") {
        const pid = (props.permissionID as string) || (props.id as string)
        if (pid) usePermissionStore.getState().remove(pid)
      }

      if (type === "session.status") {
        const sessionID = props.sessionID as string
        const status = props.status as { type: string }
        if (status?.type === "idle") useMessageStore.getState().setStreaming(sessionID, false)
        if (status?.type === "busy") useMessageStore.getState().setStreaming(sessionID, true)
      }

      if (type === "session.idle") {
        const sid = props.sessionID as string
        if (sid) useMessageStore.getState().setStreaming(sid, false)
      }

      if (type === "session.error") {
        const sid = (props.sessionID as string) || (props.sessionId as string)
        if (sid) useMessageStore.getState().setStreaming(sid, false)
      }

      if (type === "session.created" || type === "session.updated" || type === "session.deleted") {
        useSessionStore.getState().loadSessions()
      }
    })
    return unsubscribe
  }, [enabled])
}
