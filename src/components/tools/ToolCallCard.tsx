import { useState } from "react"
import type { ToolPart } from "@opencode-ai/sdk/client"

export function ToolCallCard({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(true)
  const state = part.state
  const input = state.input || {}
  const tool = part.tool
  const filePath = input.file_path as string | undefined
  const command = input.command as string | undefined
  const pattern = (input.pattern as string | undefined) || (input.query as string | undefined) || (input.text as string | undefined)
  const isRunning = state.status === "running" || state.status === "pending"
  const isError = state.status === "error"

  const marker = isError ? "✕" : isRunning ? "◐" : "▣"
  const isGrep = tool === "grep"
  const isGlob = tool === "glob"

  return (
    <div className={`my-2 border font-mono text-[11px] ${isError ? "border-error/30 bg-error-soft" : "border-border bg-bg-surface"}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-bg-hover">
        <span className={`text-[11px] ${isError ? "text-error" : isRunning ? "text-accent animate-pulse" : "text-text-muted"}`}>{marker}</span>
        <span className="font-semibold text-text-primary">{tool}</span>
        <span className={`text-[10px] px-1 py-0.5 rounded border ${isRunning ? "border-accent/20 text-accent" : isError ? "border-error/20 text-error" : "border-success/20 text-success"}`}>{state.status}</span>
        <span className="ml-auto truncate max-w-[260px] text-text-muted">{filePath ? filePath : command ? `$ ${command}` : pattern ? (isGrep ? `/${pattern}/` : pattern) : ""}</span>
        <span className={`text-text-muted text-[10px] ${open ? "" : "opacity-60"}`}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="border-t border-border bg-bg-primary px-2.5 py-2 max-h-[280px] overflow-auto">
          {isRunning ? (
            <div className="flex items-center gap-2 text-text-muted"><span className="w-2 h-2 border border-accent/30 border-t-accent rounded-full animate-spin" /> running {tool}…</div>
          ) : isError && "error" in state ? (
            <pre className="whitespace-pre-wrap text-error text-[11px]">{state.error}</pre>
          ) : state.status === "completed" && "output" in state && state.output ? (
            isGlob ? (
              <div className="space-y-0.5">
                {String(state.output).split("\n").filter(Boolean).map((line, i) => (
                  <div key={i} className="flex gap-2"><span className="text-text-muted">·</span><span className="truncate text-text-secondary">{line}</span></div>
                ))}
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-text-secondary text-[11px]">{String(state.output)}</pre>
            )
          ) : (
            <div className="text-text-muted">(no output)</div>
          )}
        </div>
      )}
    </div>
  )
}
