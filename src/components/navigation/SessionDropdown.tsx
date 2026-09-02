import { useEffect, useRef } from "react"
import { useSessionStore } from "../../stores/session"
export function SessionDropdown({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sessions, setActiveSession } = useSessionStore()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }; if (open) document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h) }, [open, onClose])
  if (!open) return null
  const sorted = [...sessions].sort((a, b) => (b.time?.updated || 0) - (a.time?.updated || 0))
  return (
    <div ref={ref} className="absolute right-0 top-9 w-[320px] rounded-xl border border-border bg-bg-secondary shadow-soft overflow-hidden z-40">
      <div className="px-3 py-2 border-b border-border flex justify-between"><span className="text-[11px] font-semibold">History</span><span className="text-[10px] text-text-muted">{sorted.length} sessions</span></div>
      <div className="max-h-[320px] overflow-y-auto">{sorted.map((s) => <button key={s.id} onClick={() => { setActiveSession(s.id); onClose() }} className="w-full text-left px-3 py-2 hover:bg-bg-tertiary border-b border-border/40 last:border-0"><div className="text-[12px] font-medium truncate">{s.title || "New Chat"}</div><div className="text-[11px] text-text-muted font-mono truncate">{new Date(s.time?.updated || s.time?.created || Date.now()).toLocaleString()} · {s.id.slice(0, 8)}</div></button>)} {sorted.length===0 && <div className="p-6 text-center text-[11px] text-text-muted">No history</div>}</div>
    </div>
  )
}
