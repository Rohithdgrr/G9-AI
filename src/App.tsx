import { useEffect } from "react"
import { useConnectionStore } from "./stores/connection"
import { useSessionStore } from "./stores/session"
import { useUIStore } from "./stores/uiStore"
import { useEventStream } from "./hooks/useEventStream"
import { useProjectStore } from "./stores/project"
import { ConnectionScreen } from "./components/connection/ConnectionScreen"
import { TopNav } from "./components/navigation/TopNav"
import { ChatContainer } from "./components/chat/ChatContainer"
import { ChatInput } from "./components/input/ChatInput"
import { SettingsModal } from "./components/settings/SettingsModal"
import { NotificationToast } from "./components/ui/Notification"
import { useMessageStore } from "./stores/message"

export default function App() {
  const { status, connect } = useConnectionStore()
  const { loadSessions } = useSessionStore()
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const { loadProject } = useProjectStore()
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const setSettings = useUIStore((s) => s.setSettings)
  const loadMessages = useMessageStore((s) => s.loadMessages)

  useEventStream(status === "connected")

  useEffect(() => {
    if (status !== "disconnected") return
    ;(async () => {
      try { const tauri = await import("@tauri-apps/api/core").catch(() => null) as any; if (tauri?.invoke) { await tauri.invoke("ensure_opencode_server", { port: 4096 }).catch(() => {}); await new Promise((r) => setTimeout(r, 700)) } } catch {}
      const cur = useConnectionStore.getState().status
      if (cur === "disconnected") await connect("http://localhost:4096").catch(() => {})
    })()
  }, [status, connect])

  useEffect(() => { if (status === "connected") { loadSessions(); loadProject() } }, [status, loadSessions, loadProject])
  useEffect(() => { if (activeSessionId) loadMessages(activeSessionId) }, [activeSessionId, loadMessages])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") { e.preventDefault(); setSettings(!settingsOpen) }
      if (e.key === "Escape" && settingsOpen) setSettings(false)
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [settingsOpen, setSettings])

  if (status !== "connected") return <ConnectionScreen />

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      <NotificationToast />
      <TopNav />
      {activeSessionId ? (
        <>
          <ChatContainer sessionId={activeSessionId} />
          <ChatInput sessionId={activeSessionId} />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8 bg-bg-primary">
          <div className="text-center">
            <h2 className="font-display text-[20px] font-semibold text-text-primary">No session yet</h2>
            <p className="text-[12px] text-text-muted mt-1">Click + to start a new chat</p>
            <button onClick={() => useSessionStore.getState().createSession()} className="mt-3 px-4 py-2 rounded-full bg-accent text-white text-[12px]">New Chat</button>
          </div>
        </div>
      )}
      <SettingsModal open={settingsOpen} onClose={() => setSettings(false)} />
    </div>
  )
}
