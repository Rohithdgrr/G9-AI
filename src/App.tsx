import { useEffect, useState, useMemo } from "react"
import { useConnectionStore } from "./stores/connection"
import { useSessionStore } from "./stores/session"
import { useMessageStore } from "./stores/message"
import { useEventStream } from "./hooks/useEventStream"
import { usePermissionStore } from "./stores/permission"
import { useProjectStore } from "./stores/project"
import { ConnectionScreen } from "./components/connection/ConnectionScreen"
import { NotificationToast } from "./components/ui/Notification"
import { MessageList } from "./components/chat/MessageList"
import { InputArea } from "./components/chat/InputArea"
import { SettingsPanel } from "./components/settings/SettingsPanel"
import { CommandPalette } from "./components/command/CommandPalette"
import { DiffView, VcsStatus } from "./components/vcs/VcsStatus"
import { getClient } from "./sdk/client"

function SSEBanner() {
  const retryCount = useConnectionStore((s) => s.sseRetryCount)
  const lastError = useConnectionStore((s) => s.sseLastError)
  const maxRetries = 15

  if (retryCount === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[150] bg-amber-500/10 border-t border-amber-500/30 px-4 py-2.5 text-center backdrop-blur-md">
      <span className="text-[12px] font-medium text-amber-600">
        {retryCount >= maxRetries
          ? "SSE streaming unavailable — check server and refresh"
          : `Reconnecting to SSE stream… (attempt ${retryCount}/${maxRetries})`}
      </span>
      {lastError && (
        <span className="ml-2 text-[11px] text-amber-500/80 truncate max-w-[400px] inline-block align-middle">{lastError}</span>
      )}
    </div>
  )
}

function App() {
  const { status, connect } = useConnectionStore()
  const { sessions, activeSessionId, loadSessions, createSession, setActiveSession, deleteSession, renameSession, forkSession, shareSession, summarizeSession } = useSessionStore()
  const { loadMessages, streaming } = useMessageStore()
  const pendingCount = usePermissionStore((s) => s.pending.size)
  const { current, vcs, loadProject, openFolder } = useProjectStore()
  const [query, setQuery] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteMode, setPaletteMode] = useState<"files" | "text" | "symbols">("files")
  const [diffOpen, setDiffOpen] = useState(false)
  const [inputText, setInputText] = useState("")

  useEventStream(status === "connected")

  const handleNewSession = async () => { await createSession() }

  useEffect(() => {
    if (status !== "disconnected") return
    let cancelled = false
    ;(async () => {
      try {
        const tauri = await import("@tauri-apps/api/core").catch(() => null) as unknown as { invoke: (cmd: string, args?: unknown) => Promise<unknown> } | null
        if (tauri?.invoke) {
          await tauri.invoke("ensure_opencode_server", { port: 4096 }).catch(() => {})
          await new Promise((r) => setTimeout(r, 700))
        }
      } catch {}
      if (cancelled) return
      const { status: cur } = useConnectionStore.getState()
      if (cur === "disconnected") {
        await connect("http://localhost:4096").catch(() => {})
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  useEffect(() => { if (status === "connected") { loadSessions(); loadProject() } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])
  useEffect(() => { if (activeSessionId) loadMessages(activeSessionId) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") { e.preventDefault(); handleNewSession() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteMode("files"); setPaletteOpen(true) }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") { e.preventDefault(); setPaletteMode("files"); setPaletteOpen(true) }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); setPaletteMode("text"); setPaletteOpen(true) }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") { e.preventDefault(); setPaletteMode("symbols"); setPaletteOpen(true) }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") { e.preventDefault(); setSettingsOpen((v) => !v) }
      if (e.key === "Escape" && activeSessionId) {
        const s = useMessageStore.getState().streaming.get(activeSessionId)
        if (s?.active) useMessageStore.getState().abortMessage(activeSessionId)
        else if (paletteOpen) setPaletteOpen(false)
        else if (diffOpen) setDiffOpen(false)
        else if (settingsOpen) setSettingsOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeSessionId, settingsOpen, paletteOpen, diffOpen])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter((s) => (s.title || "New Chat").toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
  }, [sessions, query])

  if (status !== "connected") return <ConnectionScreen />

  return (
    <div className="flex h-full bg-bg-primary">
      <NotificationToast />
      <SSEBanner />
      <div className="w-[280px] shrink-0 bg-bg-secondary border-r border-border flex flex-col font-mono">
        <div className="h-8 px-2.5 flex items-center gap-2 border-b border-border shrink-0">
          <div className="w-5 h-5 rounded bg-accent flex items-center justify-center text-white text-[10px] font-bold">G</div>
          <span className="text-[12px] font-semibold text-text-primary tracking-tight">Ganesha</span>
          <span className="text-[9px] px-1 py-0.5 rounded bg-accent-soft border border-accent/15 text-accent">BETA</span>
          <button onClick={handleNewSession} className="ml-auto w-6 h-6 rounded border border-border bg-bg-surface hover:bg-bg-hover text-text-muted hover:text-text-primary flex items-center justify-center text-[12px]" title="New chat (Ctrl+N)">+</button>
        </div>

        <div className="p-2 border-b border-border space-y-2">
          <button onClick={handleNewSession} className="w-full py-2 rounded bg-accent hover:bg-accent-hover text-white text-[11px] font-semibold flex items-center justify-center gap-1">+ New Chat</button>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-[11px]">⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search… Ctrl+K" className="w-full pl-7 pr-2 py-1.5 rounded border border-border bg-bg-surface text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1 space-y-px">
          {filtered.map((s) => (
            <div key={s.id} className={`group text-left rounded border-l-[2px] px-2 py-2 ${s.id === activeSessionId ? "bg-bg-tertiary border-accent" : "bg-transparent border-transparent hover:bg-bg-hover"}`}>
              {editingId === s.id ? (
                <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={async () => { if (editTitle.trim()) await renameSession(s.id, editTitle.trim()); setEditingId(null) }} onKeyDown={async (e) => { if (e.key === "Enter" && editTitle.trim()) { await renameSession(s.id, editTitle.trim()); setEditingId(null) } if (e.key === "Escape") setEditingId(null) }} className="w-full px-2 py-1 rounded border border-accent text-[11px] bg-bg-surface focus:outline-none" />
              ) : (
                <>
                  <button onClick={() => setActiveSession(s.id)} className="w-full text-left">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] ${s.id === activeSessionId ? "text-accent" : "text-text-muted"}`}>▸</span>
                      <span className="text-[11px] font-medium text-text-primary truncate flex-1">{s.title || "New Chat"}</span>
                      {s.id === activeSessionId && <span className="w-1 h-1 rounded-full bg-success" />}
                    </div>
                    <div className="text-[10px] text-text-muted truncate mt-0.5 pl-3.5">{new Date(s.time.created).toLocaleDateString()} {new Date(s.time.created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {s.id.slice(0, 6)}</div>
                  </button>
                  <div className="hidden group-hover:flex items-center gap-1 mt-1 pl-3.5">
                    <button onClick={() => { setEditingId(s.id); setEditTitle(s.title || "") }} className="text-[10px] px-1 py-0.5 rounded border border-border hover:border-accent/30 text-text-muted">Rename</button>
                    <button onClick={() => deleteSession(s.id)} className="text-[10px] px-1 py-0.5 rounded border border-error/20 text-error hover:bg-error-soft">Del</button>
                    <button onClick={() => forkSession(s.id)} className="text-[10px] px-1 py-0.5 rounded border border-border text-text-muted">Fork</button>
                  </div>
                </>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="mx-2 mt-8 text-center">
              <div className="text-[11px] text-text-muted">{query ? "No matches" : "No conversations yet"}</div>
              <div className="text-[10px] text-text-muted mt-1">{query ? "Try another search" : "Press + to start"}</div>
            </div>
          )}
        </div>

        <div className="p-2 border-t border-border flex items-center gap-2">
          <button onClick={() => setSettingsOpen(true)} className="flex-1 py-1.5 rounded border border-border bg-bg-surface hover:bg-bg-hover text-[11px] text-text-secondary flex items-center justify-center gap-1">⚙ Settings</button>
          <span className="text-[10px] text-text-muted">{sessions.length} · live</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-8 px-3 flex items-center gap-1.5 border-b border-border bg-bg-panel shrink-0 font-mono">
          <span className="text-[11px] text-text-muted truncate flex-1">{activeSessionId ? (sessions.find((s) => s.id === activeSessionId)?.title || "New Chat") : "Ganesha — OpenCode Chat"}</span>
          <span className="text-[10px] text-text-muted hidden sm:inline">{current?.directory ? current.directory.split(/[/\\]/).pop() : ""}</span>
          <button onClick={() => { setPaletteMode("files"); setPaletteOpen(true) }} className="hidden sm:inline-flex text-[10px] px-2 py-1 rounded border border-border hover:bg-bg-hover text-text-muted" title="Find files (Ctrl+P)">⌕ Files</button>
          <button onClick={() => { setPaletteMode("text"); setPaletteOpen(true) }} className="hidden sm:inline-flex text-[10px] px-2 py-1 rounded border border-border hover:bg-bg-hover text-text-muted" title="Find text (Ctrl+Shift+F)">⌕ Text</button>
          {pendingCount > 0 && <span className="text-[11px] px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-600 font-medium animate-pulse">⚠ {pendingCount}</span>}
          {import.meta.env.DEV && activeSessionId && pendingCount === 0 && (
            <button onClick={() => { const id = `perm_${Date.now()}`; usePermissionStore.getState().add({ id, type: "bash", pattern: ["npm test", "npm *"], sessionID: activeSessionId, messageID: `msg_${Date.now()}`, title: "Agent wants to run: npm test", metadata: { command: "npm test" }, time: { created: Date.now() } } as unknown as import("./stores/permission").Permission) }} className="text-[11px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/15 text-amber-600">Test perm</button>
          )}
          {activeSessionId && streaming.get(activeSessionId)?.active && (
            <button onClick={async () => { const s = useMessageStore.getState(); await s.abortMessage(activeSessionId) }} className="text-[11px] px-2.5 py-1 rounded-full bg-error text-white font-medium">■ Stop</button>
          )}
          {activeSessionId && (
            <button onClick={async () => { const msgs = useMessageStore.getState().messages.get(activeSessionId) || []; const last = msgs[msgs.length - 1]; if (!last || last.info.role !== "assistant") return; try { await getClient().session.revert({ path: { id: activeSessionId }, body: { messageID: last.info.id } }); useMessageStore.getState().loadMessages(activeSessionId) } catch {} }} className="text-[11px] px-2 py-1 rounded-full bg-bg-tertiary border border-border text-text-muted hover:text-text-primary" title="Revert last">↩ Revert</button>
          )}
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-bg-tertiary border border-border text-text-muted"><span className="w-1.5 h-1.5 rounded-full bg-success" /> {sessions.length}</span>
          <button onClick={() => setSettingsOpen(true)} className="w-7 h-7 rounded-lg bg-bg-tertiary border border-border hover:border-accent/30 text-text-muted hover:text-text-primary flex items-center justify-center text-[12px]" title="Settings (Ctrl+,)">⚙</button>
        </div>

        {activeSessionId ? (
          <>
            <div className="flex-1 flex flex-col min-h-0" data-active-session={activeSessionId}>
              <MessageList sessionId={activeSessionId} />
            </div>
            <InputArea sessionId={activeSessionId} onSelectFile={(p) => setInputText((t) => t + (t ? " " : "") + `@${p} `)} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-[560px] animate-fadeIn">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xl shadow-glow">✦</div>
              <h2 className="text-[18px] font-semibold tracking-tight text-text-primary">Welcome to Ganesha</h2>
              <p className="text-[12px] leading-relaxed text-text-muted mt-1.5">Open a folder, pick a model, then chat — agent will read, edit, and run tasks.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button onClick={openFolder} className="px-4 py-2 rounded-xl bg-accent text-white text-[12px] font-semibold">📂 Open Folder</button>
                <button onClick={() => { setPaletteMode("files"); setPaletteOpen(true) }} className="px-4 py-2 rounded-xl bg-bg-tertiary border border-border text-[12px] font-medium text-text-secondary">⌕ Find Files</button>
                <button onClick={() => setSettingsOpen(true)} className="px-4 py-2 rounded-xl bg-bg-tertiary border border-border text-[12px] font-medium text-text-secondary">⚙ Model</button>
              </div>
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
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onSelectFile={(p) => { if (activeSessionId) { const el = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Ask anything"]'); if (el) { const cur = el.value; const next = cur + (cur ? " " : "") + `@${p} `; el.value = next; el.dispatchEvent(new Event("input", { bubbles: true })); el.focus() } } }} />
      {diffOpen && activeSessionId && <DiffView sessionId={activeSessionId} onClose={() => setDiffOpen(false)} />}
    </div>
  )
}

export default App
