import { useState } from "react"
import type { ToolPart } from "@opencode-ai/sdk/client"

export function BashOutput({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(true)
  const state = part.state
  const input = state.input as Record<string, string>
  const command = (input.command || "") as string
  const isRunning = state.status === "running" || state.status === "pending"
  const isError = state.status === "error"
  const output = state.status === "completed" && "output" in state ? (state.output as string) : ""
  const errorMsg = isError && "error" in state ? (state as { error: string }).error : ""

  return (
    <div className={`my-2 border font-mono text-[11px] ${isError ? "border-error/30 bg-error-soft" : "border-border bg-bg-surface"}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left hover:bg-bg-hover">
        <span className={`text-[11px] ${isError ? "text-error" : isRunning ? "text-accent animate-pulse" : "text-success"}`}>{isError ? "✕" : isRunning ? "◐" : "▣"}</span>
        <span className="text-text-primary font-semibold">bash</span>
        <span className="truncate text-success ml-1">$ {command || "bash"}</span>
        <span className="ml-auto text-[10px] px-1 py-0.5 rounded border border-border text-text-muted">{state.status}</span>
        <span className="text-text-muted text-[10px]">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="border-t border-border bg-bg-primary px-2.5 py-2 max-h-[320px] overflow-auto">
          <div className="text-success/80 mb-1">$ {command}</div>
          {isRunning ? (
            <div className="flex items-center gap-2 text-text-muted"><span className="w-2 h-2 border border-accent/30 border-t-accent rounded-full animate-spin" /> executing…</div>
          ) : isError ? (
            <pre className="whitespace-pre-wrap text-error">{errorMsg}</pre>
          ) : output ? (
            <pre className="whitespace-pre-wrap text-text-secondary">{output}</pre>
          ) : (
            <span className="text-text-muted">(no output)</span>
          )}
        </div>
      )}
    </div>
  )
}
