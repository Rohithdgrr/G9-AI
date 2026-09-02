import { useState } from "react"

export function ReasoningBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const preview = text.slice(0, 160)
  const isLong = text.length > 160
  return (
    <div className="my-2 border border-border bg-bg-surface font-mono text-[11px]">
      <button onClick={() => setOpen((v) => !v)} className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-bg-hover">
        <span className="text-warning">◐</span>
        <span className="font-semibold text-text-primary">reasoning</span>
        <span className="text-[10px] px-1 py-0.5 rounded border border-border text-text-muted">{isLong ? `${text.length} chars` : "thinking"}</span>
        <span className="ml-auto text-text-muted">{open ? "▾ hide" : "▸ preview"}</span>
      </button>
      <div className="px-2.5 pb-2">
        <div className={`whitespace-pre-wrap leading-5 ${open ? "max-h-[240px] overflow-auto border border-border bg-bg-primary p-2 text-text-secondary" : "text-text-muted"}`}>
          {open ? text : isLong ? preview + "…" : text}
        </div>
        {!open && isLong && <button onClick={() => setOpen(true)} className="mt-1 text-accent hover:underline">expand →</button>}
      </div>
    </div>
  )
}
