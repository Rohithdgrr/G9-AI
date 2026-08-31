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
    <div className={`my-2.5 rounded-xl border overflow-hidden message-enter ${isError ? "border-error/25 bg-error-soft" : "border-border bg-[#0a0a0b]"}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left hover:bg-white/[0.04] transition-colors">
        <span className="w-7 h-7 rounded-lg bg-[#1a1a1d] border border-border flex items-center justify-center text-success text-[12px] font-mono">$</span>
        <span className="text-[11px] font-mono text-success truncate max-w-[420px]">{command ? `$ ${command}` : "bash"}</span>
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${isRunning ? "bg-accent-soft border-accent/20 text-accent" : isError ? "bg-error/10 border-error/20 text-error" : "bg-success-soft border-success/20 text-success"}`}>{state.status}</span>
        <span className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="mx-2 mb-2 rounded-lg border border-[#1f1f23] bg-[#08080a] overflow-hidden relative">
          {/* Terminal header */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111113] border-b border-[#1f1f23]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
            <span className="ml-2 text-[11px] font-mono text-text-muted">bash — ganesha</span>
            <button onClick={async () => { const txt = output || errorMsg; if (txt) await navigator.clipboard.writeText(txt) }} className="ml-auto text-[11px] px-2 py-1 rounded bg-[#1a1a1d] border border-[#27272a] text-text-muted hover:text-text-primary">Copy output</button>
          </div>
          <div className="px-3 py-3 font-mono text-[12px] leading-6 max-h-[340px] overflow-auto">
            <div className="text-success/90 mb-1">$ {command}</div>
            {isRunning ? (
              <div className="flex items-center gap-2 text-text-muted"><span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /> executing…</div>
            ) : isError ? (
              <pre className="text-error whitespace-pre-wrap">{errorMsg}</pre>
            ) : output ? (
              <pre className="text-[#d4d4d8] whitespace-pre-wrap">{output}</pre>
            ) : (
              <span className="text-text-muted">(no output)</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
