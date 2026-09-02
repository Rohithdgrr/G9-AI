import { Plus, Clock, Settings } from "lucide-react"
import { useState } from "react"
import { useSessionStore } from "../../stores/session"
import { useUIStore } from "../../stores/uiStore"
import { SessionTabs } from "./SessionTabs"
import { SessionDropdown } from "./SessionDropdown"
export function TopNav() {
  const createSession = useSessionStore((s) => s.createSession)
  const setHistory = useUIStore((s) => s.setHistory)
  const setSettings = useUIStore((s) => s.setSettings)
  const historyOpen = useUIStore((s) => s.historyOpen)
  const [busy, setBusy] = useState(false)
  const onNew = async () => { if (busy) return; setBusy(true); try { await createSession() } finally { setBusy(false) } }
  return (
    <div className="h-[60px] px-4 flex items-center gap-3 border-b border-border bg-bg-panel shrink-0">
      <div className="flex items-center gap-2 shrink-0"><div className="w-7 h-7 rounded-[7px] bg-accent flex items-center justify-center text-white font-display font-bold text-[13px]">ग</div><span className="font-display font-semibold text-[14px]">G9-AI</span></div>
      <SessionTabs />
      <div className="flex items-center gap-1 shrink-0 relative"><button onClick={onNew} className="w-8 h-8 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center"><Plus size={16} /></button><button onClick={() => setHistory(!historyOpen)} className="w-8 h-8 rounded-full border border-border bg-bg-surface hover:bg-bg-hover text-text-muted flex items-center justify-center"><Clock size={16} /></button><button onClick={() => setSettings(true)} className="w-8 h-8 rounded-full border border-border bg-bg-surface hover:bg-bg-hover text-text-muted flex items-center justify-center"><Settings size={16} /></button><SessionDropdown open={historyOpen} onClose={() => setHistory(false)} /></div>
    </div>
  )
}
