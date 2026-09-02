import { X } from "lucide-react"
import { useSessionStore } from "../../stores/session"

function titleFor(s: { title?: string; id: string }) {
  const t = (s.title || "").trim()
  if (t) return t.slice(0, 28)
  return `New Chat · ${s.id.slice(0, 4)}`
}

export function SessionTabs() {
  const { sessions, activeSessionId, setActiveSession, deleteSession } = useSessionStore()
  const tabs = sessions.slice(0, 5)
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 justify-center px-2">
      {tabs.map((s) => {
        const active = s.id === activeSessionId
        return (
          <button key={s.id} onClick={() => setActiveSession(s.id)} className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] whitespace-nowrap ${active ? "bg-accent text-white border-accent" : "bg-bg-surface border-border text-text-muted hover:text-text-primary"}`}>
            <span className="truncate max-w-[120px]">{titleFor(s)}</span>
            <span onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }} className={`ml-1 rounded-full p-0.5 ${active ? "hover:bg-white/20" : "hover:bg-bg-hover"} opacity-40 group-hover:opacity-100`}><X size={12} /></span>
          </button>
        )
      })}
      {tabs.length === 0 && <span className="text-[11px] text-text-muted">No sessions</span>}
    </div>
  )
}
