import { useState } from "react"

export function ReasoningBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const preview = text.slice(0, 180)
  const isLong = text.length > 180
  return (
    <div className="my-2.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] overflow-hidden message-enter">
      <button onClick={() => setOpen((v) => !v)} className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left hover:bg-amber-500/[0.04] transition-colors">
        <span className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-600 text-[11px] font-bold">◐</span>
        <span className="text-[12px] font-semibold text-text-primary">Reasoning</span>
        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/15 text-amber-700 dark:text-amber-400">{isLong ? `${text.length} chars` : "thinking"}</span>
        <span className="ml-auto text-[11px] text-text-muted">{open ? "hide" : isLong ? "show" : "preview"}</span>
        <span className={`text-text-muted text-[11px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      <div className="px-3.5 pb-3">
        <div className={`text-[12px] leading-6 whitespace-pre-wrap rounded-lg border ${open ? "bg-[#0f0f12] border-border p-3 text-text-secondary max-h-[320px] overflow-auto" : "bg-transparent border-transparent p-0 text-text-muted"}`}>
          {open ? text : isLong ? preview + "…" : text}
        </div>
        {!open && isLong && <button onClick={() => setOpen(true)} className="mt-1 text-[11px] text-amber-600 hover:text-amber-500 font-medium">Expand reasoning →</button>}
      </div>
    </div>
  )
}
