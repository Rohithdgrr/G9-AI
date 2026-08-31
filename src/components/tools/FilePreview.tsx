import { useState } from "react"
import type { ToolPart } from "@opencode-ai/sdk/client"
import { getFileIcon, getLangFromPath } from "../../lib/utils"

export function FilePreview({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(true)
  const input = part.state.input as Record<string, string>
  const path = (input.file_path || input.path || "") as string
  const state = part.state
  const isError = state.status === "error"
  const isRunning = state.status === "running" || state.status === "pending"
  let content = ""
  let lineCount = 0
  if (state.status === "completed" && "output" in state) {
    content = state.output as string
    lineCount = content.split("\n").length
  }

  return (
    <div className={`my-2.5 rounded-xl border overflow-hidden message-enter ${isError ? "border-error/25 bg-error-soft" : "border-border bg-bg-tertiary/60"}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left hover:bg-bg-hover/50 transition-colors">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold border ${isError ? "bg-error/15 border-error/20 text-error" : "bg-bg-surface border-border text-text-secondary"}`}>
          {getFileIcon(path)}
        </span>
        <span className="text-[12px] font-semibold text-text-primary truncate max-w-[280px]">{path || "file"}</span>
        <span className="text-[11px] text-text-muted font-mono">{getLangFromPath(path)}{lineCount ? ` • ${lineCount} lines` : ""}</span>
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${isRunning ? "bg-accent-soft border-accent/20 text-accent" : isError ? "bg-error/10 border-error/20 text-error" : "bg-success-soft border-success/20 text-success"}`}>{state.status}</span>
        <span className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="mx-2 mb-2 rounded-lg border border-border bg-[#0f0f12] overflow-hidden relative">
          {isRunning ? (
            <div className="px-3 py-3 flex items-center gap-2 text-[12px] text-text-muted"><span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /> Reading…</div>
          ) : isError ? (
            <pre className="px-3 py-3 text-[12px] text-error whitespace-pre-wrap">{(state as { error: string }).error}</pre>
          ) : content ? (
            <>
              <button onClick={async () => { await navigator.clipboard.writeText(content) }} className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-bg-surface border border-border text-[11px] text-text-muted hover:text-text-primary">Copy</button>
              <div className="flex max-h-[380px] overflow-auto">
                <div className="shrink-0 bg-[#0a0a0f] border-r border-border px-2 py-3 text-right select-none">
                  {content.split("\n").map((_, i) => (
                    <div key={i} className="text-[11px] leading-6 font-mono text-text-muted/60">{i + 1}</div>
                  ))}
                </div>
                <pre className="flex-1 px-3 py-3 text-[12px] leading-6 font-mono text-text-secondary whitespace-pre overflow-x-auto"><code className={`language-${getLangFromPath(path)}`}>{content}</code></pre>
              </div>
            </>
          ) : (
            <div className="px-3 py-3 text-[11px] text-text-muted">No preview</div>
          )}
        </div>
      )}
    </div>
  )
}
