import { useEffect, useState, useMemo } from "react"
import { useConnectionStore } from "./stores/connection"
import { useSessionStore } from "./stores/session"
import { useMessageStore } from "./stores/message"
import { useEventStream } from "./hooks/useEventStream"
import { usePermissionStore } from "./stores/permission"
import { useSettingsStore } from "./stores/settings"
import { ConnectionScreen } from "./components/connection/ConnectionScreen"
import { MessageList } from "./components/chat/MessageList"
import { InputArea } from "./components/chat/InputArea"
import { SettingsPanel } from "./components/settings/SettingsPanel"
import { getClient } from "./sdk/client"

function App() {
  const { status } = useConnectionStore()
  const { sessions, activeSessionId, loadSessions, createSession, setActiveSession, deleteSession, renameSession } = useSessionStore()
  const { loadMessages, streaming } = useMessageStore()
  const pendingCount = usePermissionStore((s) => s.pending.size)
  const [query, setQuery] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEventStream(status === "connected")

  const handleNewSession = async () => { await createSession() }

  useEffect(() => { if (status === "connected") loadSessions() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])
  useEffect(() => { if (activeSessionId) loadMessages(activeSessionId) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId])

  // Keyboard shortcuts: Ctrl+N new session, Ctrl+K focus search, Esc abort, Ctrl+, settings
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") { e.preventDefault(); handleNewSession() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder*="Search sessions"]')?.focus() }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") { e.preventDefault(); setSettingsOpen((v) => !v) }
      if (e.key === "Escape" && activeSessionId) {
        const s = useMessageStore.getState().streaming.get(activeSessionId)
        if (s?.active) useMessageStore.getState().abortMessage(activeSessionId)
        else if (settingsOpen) setSettingsOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeSessionId, settingsOpen])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter((s) => (s.title || "New Chat").toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
  }, [sessions, query])

  if (status !== "connected") return <ConnectionScreen />

  return (
    <div className="flex h-full bg-bg-primary">
      <div className="w-[300px] shrink-0 bg-bg-secondary border-r border-border flex flex-col">
        <div className="h-12 px-3 flex items-center gap-2 border-b border-border shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-black">G</div>
          <span className="text-[13px] font-semibold tracking-tight text-text-primary">Ganesha</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-accent-soft border border-accent/20 text-accent font-medium">BETA</span>
          <button onClick={handleNewSession} className="ml-auto w-7 h-7 rounded-lg bg-bg-tertiary border border-border hover:border-accent/30 hover:text-accent text-text-muted flex items-center justify-center text-[14px] transition-colors" title="New chat">＋</button>
        </div>

        <div className="p-3 border-b border-border">
          <button onClick={handleNewSession} className="w-full py-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[12px] font-semibold tracking-wide shadow-glow transition-all flex items-center justify-center gap-1.5">＋ New Chat <span className="text-white/60 text-[11px]">• Tab</span></button>
          <div className="relative mt-2.5">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[12px]">⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sessions… (Ctrl+K)" className="w-full pl-8 pr-3 py-2 rounded-xl bg-bg-tertiary border border-border text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/30 focus:ring-4 focus:ring-accent/10 transition-all" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map((s) => (
            <div key={s.id} className={`group w-full text-left rounded-xl px-3 py-2.5 border transition-all ${s.id === activeSessionId ? "bg-bg-tertiary border-accent/20 shadow-soft" : "bg-transparent border-transparent hover:bg-bg-tertiary/60 hover:border-border"}`}>
              {editingId === s.id ? (
                <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={async () => { if (editTitle.trim()) await renameSession(s.id, editTitle.trim()); setEditingId(null) }} onKeyDown={async (e) => { if (e.key === "Enter" && editTitle.trim()) { await renameSession(s.id, editTitle.trim()); setEditingId(null) } if (e.key === "Escape") setEditingId(null) }} className="w-full px-2 py-1 rounded-lg bg-bg-surface border border-accent/30 text-[12px] text-text-primary focus:outline-none" />
              ) : (
                <>
                  <button onClick={() => setActiveSession(s.id)} className="w-full text-left">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] border ${s.id === activeSessionId ? "bg-accent-soft border-accent/20 text-accent" : "bg-bg-surface border-border text-text-muted"}`}>◈</span>
                      <span className="text-[12px] font-medium text-text-primary truncate flex-1">{s.title || "New Chat"}</span>
                      {s.id === activeSessionId && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-8">
                      <span className="text-[11px] text-text-muted">{new Date(s.time.created).toLocaleDateString()} • {new Date(s.time.created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="ml-auto text-[10px] px-1 py-0.5 rounded bg-bg-surface border border-border text-text-muted font-mono truncate max-w-[80px]">{s.id.slice(0, 8)}</span>
                    </div>
                  </button>
                  <div className="hidden group-hover:flex items-center gap-1 mt-1.5 ml-8">
                    <button onClick={() => { setEditingId(s.id); setEditTitle(s.title || "") }} className="text-[11px] px-1.5 py-0.5 rounded bg-bg-surface border border-border text-text-muted hover:text-text-primary">Rename</button>
                    <button onClick={() => deleteSession(s.id)} className="text-[11px] px-1.5 py-0.5 rounded bg-error-soft border border-error/20 text-error hover:bg-error/15">Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="mx-2 mt-6 rounded-xl border border-dashed border-border p-6 text-center">
              <div className="text-text-muted text-xl mb-1">🗂</div>
              <div className="text-[12px] text-text-secondary font-medium">{query ? "No matches" : "No conversations yet"}</div>
              <div className="text-[11px] text-text-muted mt-1">{query ? "Try a different search" : "Click New Chat to start"}</div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border">
          <div className="rounded-xl bg-bg-tertiary border border-border p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold">◉</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-text-primary leading-none">Local Workspace</div>
              <div className="text-[11px] text-text-muted truncate">ganesha • {sessions.length} sessions</div>
            </div>
            <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
            <span>v0.1.0 • Tauri</span>
            <span className="px-1.5 py-0.5 rounded-full bg-accent-soft border border-accent/15 text-accent">● live</span>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="mt-2 w-full py-1.5 rounded-xl bg-bg-surface border border-border hover:border-accent/20 text-[11px] font-medium text-text-secondary flex items-center justify-center gap-1.5">
            ⚙ Settings <span className="text-text-muted">Ctrl+,</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 px-4 flex items-center gap-2 border-b border-border bg-bg-secondary/60 backdrop-blur shrink-0">
          <span className="text-[12px] font-medium text-text-secondary truncate flex-1">{activeSessionId ? (sessions.find((s) => s.id === activeSessionId)?.title || "New Chat") : "Ganesha — OpenCode Chat"}</span>
          {pendingCount > 0 && <span className="text-[11px] px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-600 font-medium animate-pulse">⚠ {pendingCount} permission{pendingCount > 1 ? "s" : ""}</span>}
          {import.meta.env.DEV && activeSessionId && pendingCount === 0 && (
            <button
              onClick={() => {
                const id = `perm_${Date.now()}`
                usePermissionStore.getState().add({
                  id,
                  type: "bash",
                  pattern: ["npm test", "npm *"],
                  sessionID: activeSessionId,
                  messageID: `msg_${Date.now()}`,
                  title: "Agent wants to run: npm test",
                  metadata: { command: "npm test" },
                  time: { created: Date.now() },
                } as unknown as import("./stores/permission").Permission)
              }}
              className="text-[11px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/15 text-amber-600 hover:bg-amber-500/15"
              title="Inject mock permission for testing"
            >
              Test perm
            </button>
          )}
          {activeSessionId && streaming.get(activeSessionId)?.active && (
            <button onClick={async () => { const s = useMessageStore.getState(); await s.abortMessage(activeSessionId) }} className="text-[11px] px-2.5 py-1 rounded-full bg-error text-white font-medium hover:bg-error/90">■ Stop</button>
          )}
          {activeSessionId && (
            <button
              onClick={async () => {
                const msgs = useMessageStore.getState().messages.get(activeSessionId) || []
                const last = msgs[msgs.length - 1]
                if (!last || last.info.role !== "assistant") return
                try { await getClient().session.revert({ path: { id: activeSessionId }, body: { messageID: last.info.id } }); useMessageStore.getState().loadMessages(activeSessionId) } catch {}
              }}
              className="text-[11px] px-2 py-1 rounded-full bg-bg-tertiary border border-border text-text-muted hover:text-text-primary hover:border-accent/20"
              title="Revert last assistant message"
            >
              ↩ Revert
            </button>
          )}
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-bg-tertiary border border-border text-text-muted"><span className="w-1.5 h-1.5 rounded-full bg-success" /> {sessions.length} sessions</span>
          <span className="text-[11px] px-2 py-1 rounded-full bg-accent-soft border border-accent/20 text-accent font-medium">build agent</span>
          <button onClick={() => setSettingsOpen(true)} className="w-7 h-7 rounded-lg bg-bg-tertiary border border-border hover:border-accent/30 text-text-muted hover:text-text-primary flex items-center justify-center text-[12px]" title="Settings (Ctrl+,)">⚙</button>
        </div>

        {activeSessionId ? (
          <>
            <div className="flex-1 flex flex-col min-h-0" data-active-session={activeSessionId}>
              <MessageList sessionId={activeSessionId} />
            </div>
            <InputArea sessionId={activeSessionId} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-[560px] animate-fadeIn">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xl shadow-glow">✦</div>
              <h2 className="text-[18px] font-semibold tracking-tight text-text-primary">Welcome to Ganesha</h2>
              <p className="text-[12px] leading-relaxed text-text-muted mt-1.5">A minimalist, single-agent chat desktop — no file explorer, no terminal, just conversation.</p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {[
                  { t: "Explain this repo", d: "Structure, stack, and where things live" },
                  { t: "Add auth to routes", d: "JWT middleware across API routes" },
                  { t: "Find & fix a bug", d: "Grep, read, patch, and verify" },
                  { t: "Run tests", d: "Execute bash and summarize results" },
                ].map((c) => (
                  <button key={c.t} onClick={handleNewSession} className="rounded-xl border border-border bg-bg-secondary hover:bg-bg-tertiary hover:border-accent/20 text-left px-3.5 py-3 transition-colors group">
                    <div className="text-[12px] font-semibold text-text-primary group-hover:text-accent transition-colors">{c.t} →</div>
                    <div className="text-[11px] text-text-muted mt-0.5">{c.d}</div>
                  </button>
                ))}
              </div>
              <button onClick={handleNewSession} className="mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[12px] font-semibold shadow-glow transition-all">＋ New Chat</button>
            </div>
          </div>
        )}
      </div>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

export default App
