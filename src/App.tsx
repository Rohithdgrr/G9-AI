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
      <div className="w-[280px] shrink-0 bg-bg-secondary border-r border-border flex flex-col">
        <div className="h-10 px-3 flex items-center gap-2 border-b border-border shrink-0">
          <div className="w-7 h-7 rounded-[7px] bg-accent flex items-center justify-center text-white font-display text-[13px] font-bold">ग</div>
          <div className="leading-none">
            <div className="text-[12px] font-semibold tracking-tight text-text-primary font-display">Ganesha</div>
            <div className="text-[9px] tracking-[0.14em] uppercase text-text-muted">Scribe · Remove obstacles</div>
          </div>
          <span className="ml-auto text-[9px] tracking-widest uppercase px-1.5 py-1 rounded border border-accent/20 bg-accent-soft text-accent">BETA</span>
        </div>

        <div className="p-2.5 border-b border-border space-y-2">
          <div className="brass-rule" />
          <button onClick={handleNewSession} className="w-full py-2 rounded bg-error hover:opacity-90 text-white text-[11px] font-semibold tracking-wide flex items-center justify-center gap-1.5">— New sutra —</button>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-[11px]">⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sutras… ⌘K" className="w-full pl-7 pr-2 py-1.5 rounded border border-border bg-bg-surface text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 font-mono" />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-text-muted"><span className="h-px flex-1 bg-border" /> Sutras <span className="h-px flex-1 bg-border" /></div>
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

      <div className="flex-1 flex flex-col min-w-0 bg-bg-primary">
        <div className="h-10 px-4 flex items-center gap-3 border-b border-accent/10 bg-bg-panel/80 backdrop-blur shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] tracking-[0.18em] uppercase text-accent font-semibold"><span className="w-1 h-1 rounded-full bg-accent" /> Manuscript</span>
            <span className="h-3 w-px bg-border hidden sm:block" />
            <span className="text-[12px] font-display font-medium text-text-primary truncate">{activeSessionId ? (sessions.find((s) => s.id === activeSessionId)?.title || "New sutra") : "Ganesha — Scribe"}</span>
            {activeSessionId && streaming.get(activeSessionId)?.active && <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-accent animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> writing</span>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {pendingCount > 0 && <span className="text-[10px] px-2 py-1 rounded bg-error-soft border border-error/20 text-error font-medium animate-pulse">◐ {pendingCount} awaiting</span>}
            {activeSessionId && streaming.get(activeSessionId)?.active && (
              <button onClick={async () => { const s = useMessageStore.getState(); await s.abortMessage(activeSessionId) }} className="text-[10px] px-2.5 py-1 rounded bg-error text-white font-medium hover:opacity-90">■ Stop</button>
            )}
            <div className="hidden sm:flex items-center gap-1.5 pl-2 ml-1 border-l border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_6px_rgba(143,160,143,0.6)]" />
              <span className="text-[10px] tracking-wide text-text-muted font-mono">live</span>
            </div>
            <button onClick={() => setSettingsOpen(true)} className="w-7 h-7 rounded-full border border-border bg-bg-surface hover:border-accent/30 hover:bg-bg-hover text-text-muted hover:text-accent flex items-center justify-center text-[12px] transition-colors" title="Settings (Ctrl+,)">⚙</button>
          </div>
        </div>

        {activeSessionId ? (
          <>
            <div className="flex-1 flex flex-col min-h-0" data-active-session={activeSessionId}>
              <MessageList sessionId={activeSessionId} />
            </div>
            <InputArea sessionId={activeSessionId} onSelectFile={(p) => setInputText((t) => t + (t ? " " : "") + `@${p} `)} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 bg-bg-primary">
            <div className="text-center max-w-[560px] animate-fadeIn">
              <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase text-accent border border-accent/20 rounded-full px-3 py-1 bg-accent-soft">◈ Temple manuscript — ink on paper</div>
              <h2 className="font-display text-[28px] font-semibold tracking-tight text-text-primary mt-3">Begin a new sutra</h2>
              <p className="text-[12px] leading-relaxed text-text-muted mt-2 max-w-[46ch] mx-auto">Ganesha holds the thread. Ask, and the scribe will read the leaves, edit the margins, and run the tests.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button onClick={openFolder} className="px-4 py-2 rounded bg-error text-white text-[12px] font-semibold">Open Folder</button>
                <button onClick={() => { setPaletteMode("files"); setPaletteOpen(true) }} className="px-4 py-2 rounded border border-border bg-bg-surface text-[12px]">⌕ Find Files</button>
                <button onClick={() => setSettingsOpen(true)} className="px-4 py-2 rounded border border-border bg-bg-surface text-[12px]">Choose Model</button>
              </div>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {[
                  { t: "Explain this repo", d: "Structure, stack, and where things live" },
                  { t: "Add auth to routes", d: "JWT middleware across API routes" },
                  { t: "Find & fix a bug", d: "Grep, read, patch, and verify" },
                  { t: "Run tests", d: "Execute bash and summarize results" },
                ].map((c) => (
                  <button key={c.t} onClick={handleNewSession} className="rounded border border-border bg-bg-secondary hover:bg-bg-surface hover:border-accent/20 text-left px-3.5 py-3 transition-colors group">
                    <div className="text-[12px] font-semibold text-text-primary group-hover:text-accent font-display">{c.t} →</div>
                    <div className="text-[11px] text-text-muted mt-0.5">{c.d}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 brass-rule" />
              <button onClick={handleNewSession} className="mt-4 px-5 py-2 rounded bg-accent hover:bg-accent-hover text-white text-[11px] font-semibold tracking-wide">＋ New sutra</button>
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
