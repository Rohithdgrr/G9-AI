import { useState } from "react"
import type { ToolPart } from "@opencode-ai/sdk/client"

const ICON: Record<string, string> = {
  read: "📄", edit: "✎", write: "＋", bash: "▸", grep: "⌕", glob: "🗂", webfetch: "🌐", websearch: "🔎", task: "◈", question: "❓",
}

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

  // Specialize grep/glob rendering
  const isGrep = tool === "grep"
  const isGlob = tool === "glob"

  return (
    <div className={`my-2.5 rounded-xl border overflow-hidden message-enter ${isError ? "border-error/25 bg-error-soft" : isGrep || isGlob ? "border-violet-500/15 bg-violet-500/[0.04]" : "border-border bg-bg-tertiary/60"}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left hover:bg-bg-hover/50 transition-colors">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[13px] border ${isError ? "bg-error/15 border-error/20" : isRunning ? "bg-accent-soft border-accent/20 text-accent" : isGrep ? "bg-violet-500/15 border-violet-500/20 text-violet-400" : isGlob ? "bg-indigo-500/15 border-indigo-500/20 text-indigo-400" : "bg-bg-surface border-border text-text-secondary"}`}>
          {ICON[tool] || "🔧"}
        </span>
        <span className="text-[12px] font-semibold tracking-wide text-text-primary">{tool}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${isRunning ? "bg-accent-soft border-accent/20 text-accent" : isError ? "bg-error/10 border-error/20 text-error" : "bg-success-soft border-success/20 text-success"}`}>{state.status}</span>
        <span className="ml-auto text-[11px] text-text-muted truncate max-w-[260px] font-mono">
          {filePath ? filePath : command ? `$ ${command}` : pattern ? (isGrep ? `/${pattern}/` : pattern) : ""}
        </span>
        <span className={`ml-1 text-text-muted transition-transform text-[11px] ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="mx-2 mb-2 rounded-lg border border-border bg-[#0f0f12] overflow-hidden relative">
          {isRunning ? (
            <div className="px-3 py-2.5 flex items-center gap-2 text-[12px] text-text-muted"><span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /> Running {tool}…</div>
          ) : isError && "error" in state ? (
            <pre className="px-3 py-3 text-[12px] leading-relaxed text-error whitespace-pre-wrap">{state.error}</pre>
          ) : state.status === "completed" && "output" in state && state.output ? (
            <>
              <button onClick={async () => { await navigator.clipboard.writeText(state.output as string) }} className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-bg-surface border border-border text-[11px] text-text-muted hover:text-text-primary">Copy</button>
              {isGrep ? (
                <pre className="px-3 py-3 pr-14 text-[12px] leading-6 whitespace-pre-wrap max-h-[320px] overflow-auto font-mono">{String(state.output)}</pre>
              ) : isGlob ? (
                <div className="px-3 py-3 pr-14 text-[12px] leading-6 max-h-[320px] overflow-auto font-mono text-text-secondary">
                  {String(state.output).split("\n").filter(Boolean).map((line, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5"><span className="text-text-muted">•</span> <span className="truncate">{line}</span></div>
                  ))}
                </div>
              ) : (
                <pre className="px-3 py-3 pr-14 text-[12px] leading-relaxed text-text-secondary whitespace-pre-wrap max-h-[320px] overflow-auto">{String(state.output)}</pre>
              )}
            </>
          ) : (
            <div className="px-3 py-2.5 text-[11px] text-text-muted">No output</div>
          )}
        </div>
      )}
    </div>
  )
}
