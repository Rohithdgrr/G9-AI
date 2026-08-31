import { useState } from "react"
import type { ToolPart } from "@opencode-ai/sdk/client"
import { getLangFromPath } from "../../lib/utils"

export function DiffViewer({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(true)
  const state = part.state
  const input = state.input as Record<string, string>
  const path = (input.file_path || input.path || "") as string
  const isRunning = state.status === "running" || state.status === "pending"
  const isError = state.status === "error"
  const output = state.status === "completed" && "output" in state ? (state.output as string) : ""

  // Try to parse unified diff lines
  const lines = output ? output.split("\n") : []
  const hasDiffMarkers = output.includes("@@") || output.includes("+++") || output.includes("---")

  if (isRunning || isError || !hasDiffMarkers) {
    // Fallback to generic rendering
    if (state.status !== "completed" || !output) {
      return (
        <div className={`my-2.5 rounded-xl border overflow-hidden ${isError ? "border-error/25 bg-error-soft" : "border-border bg-bg-tertiary/60"}`}>
          <div className="px-3.5 py-2.5 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-success/15 border border-success/20 flex items-center justify-center text-success text-[13px]">✎</span>
            <span className="text-[12px] font-semibold text-text-primary truncate">{path || "edit"}</span>
            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full border ${isRunning ? "bg-accent-soft border-accent/20 text-accent" : "bg-error/10 border-error/20 text-error"}`}>{state.status}</span>
          </div>
          <div className="mx-2 mb-2 rounded-lg border border-border bg-[#0f0f12] px-3 py-3 text-[12px] text-text-muted">
            {isRunning ? "Applying edit…" : isError ? (state as { error: string }).error : "No diff output"}
          </div>
        </div>
      )
    }
  }

  return (
    <div className="my-2.5 rounded-xl border border-success/20 bg-success-soft/30 overflow-hidden message-enter">
      <button onClick={() => setOpen((v) => !v)} className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left hover:bg-success/5 transition-colors">
        <span className="w-7 h-7 rounded-lg bg-success/15 border border-success/20 flex items-center justify-center text-success text-[13px]">✎</span>
        <span className="text-[12px] font-semibold text-text-primary">Edit</span>
        <span className="text-[11px] font-mono text-text-muted truncate max-w-[260px]">{path}</span>
        <span className={`ml-1 text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#0f0f12] border border-border text-text-muted`}>{getLangFromPath(path)}</span>
        <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded-full bg-success/15 border border-success/20 text-success">diff • {lines.length} lines</span>
        <span className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="mx-2 mb-2 rounded-lg border border-border bg-[#0f0f12] overflow-hidden relative">
          <button onClick={async () => { if (output) await navigator.clipboard.writeText(output) }} className="absolute top-2 right-2 z-10 px-2 py-1 rounded-lg bg-bg-surface border border-border text-[11px] text-text-muted hover:text-text-primary">Copy diff</button>
          <div className="overflow-auto max-h-[420px] font-mono text-[12px] leading-5">
            {lines.map((line, i) => {
              const isAdd = line.startsWith("+") && !line.startsWith("+++")
              const isRemove = line.startsWith("-") && !line.startsWith("---")
              const isHunk = line.startsWith("@@")
              const bg = isAdd ? "bg-[rgba(34,197,94,0.12)] text-[#86efac]" : isRemove ? "bg-[rgba(239,68,68,0.10)] text-[#fca5a5]" : isHunk ? "bg-[rgba(99,102,241,0.12)] text-[#a5b4fc]" : "text-text-secondary"
              const marker = isAdd ? "+" : isRemove ? "-" : isHunk ? "◈" : " "
              return (
                <div key={i} className={`flex px-3 py-0.5 ${bg}`}>
                  <span className="w-6 shrink-0 text-right pr-2 select-none opacity-60">{marker}</span>
                  <span className="whitespace-pre-wrap break-all flex-1">{line.startsWith("+") || line.startsWith("-") || line.startsWith("@@") ? line.slice(line.startsWith("@@") ? 0 : 1) : line}</span>
                </div>
              )
            })}
          </div>
          <div className="px-3 py-1.5 bg-bg-secondary/60 border-t border-border text-[11px] font-mono text-text-muted flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-success" /> {lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length} additions
            <span className="w-2 h-2 rounded-full bg-error" /> {lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length} deletions
          </div>
        </div>
      )}
    </div>
  )
}
