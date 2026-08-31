import { useEffect, useState, useRef } from "react"
import { getClient } from "../../sdk/client"

type Mode = "files" | "text" | "symbols"

interface Props {
  open: boolean
  onClose: () => void
  onSelectFile: (path: string) => void
}

export function CommandPalette({ open, onClose, onSelectFile }: Props) {
  const [mode, setMode] = useState<Mode>("files")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<{ path: string; line?: number; preview?: string }>>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(""); setResults([]) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const id = setTimeout(async () => {
      if (!query.trim() && mode === "files") {
        // show recent files
        try {
          const c = getClient()
          const r = await c.find.files({ query: { query: "", limit: 12 } as unknown as { query: string } })
          const files = (r.data as string[]) || []
          setResults(files.map((p) => ({ path: p })))
        } catch { setResults([]) }
        return
      }
      if (!query.trim()) { setResults([]); return }
      setLoading(true)
      try {
        const c = getClient()
        if (mode === "files") {
          const r = await c.find.files({ query: { query } } as unknown as { query: { query: string } })
          const files = (r.data as string[]) || []
          setResults(files.slice(0, 20).map((p) => ({ path: p })))
        } else if (mode === "text") {
          const r = await c.find.text({ query: { pattern: query } } as unknown as { query: { pattern: string } })
          const hits = (r.data as unknown as Array<{ path: string | { text: string }; lines?: string | { text: string }; line_number?: number }>) || []
          setResults(hits.slice(0, 20).map((h) => {
            const p = typeof h.path === "string" ? h.path : (h.path as { text: string }).text
            const lines = typeof h.lines === "string" ? h.lines : (h.lines as { text: string } | undefined)?.text
            return { path: p, line: h.line_number, preview: lines }
          }))
        } else if (mode === "symbols") {
          const r = await c.find.symbols({ query: { query } } as unknown as { query: { query: string } })
          const syms = (r.data as unknown as Array<{ name: string; path: string | { text: string }; range?: { start: { line: number } } }>) || []
          setResults(syms.slice(0, 20).map((s) => {
            const p = typeof s.path === "string" ? s.path : (s.path as { text: string }).text
            return { path: `${p}:${s.range?.start.line || 0}`, preview: s.name }
          }))
        }
      } catch { setResults([]) }
      setLoading(false)
    }, 300)
    return () => clearTimeout(id)
  }, [query, mode, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[640px] mx-4 rounded-2xl border border-border bg-bg-secondary shadow-soft overflow-hidden animate-fadeIn">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <div className="flex items-center gap-1">
            {(["files", "text", "symbols"] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize border ${mode === m ? "bg-accent text-white border-accent" : "bg-bg-tertiary border-border text-text-muted hover:border-accent/20"}`}>{m}</button>
            ))}
          </div>
          <span className="ml-auto text-[11px] text-text-muted hidden sm:inline">Ctrl+K • Ctrl+P files • Ctrl+Shift+F text • Ctrl+T symbols • Esc close</span>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onClose() }}
            placeholder={mode === "files" ? "Search files… (fuzzy)" : mode === "text" ? "Search text (regex)…" : "Search symbols…"}
            className="w-full pl-9 pr-3 py-3 bg-bg-tertiary text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />}
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-text-muted">{query ? "No results" : mode === "files" ? "Type to search files" : mode === "text" ? "Type regex to grep" : "Type to find symbols"}</div>
          ) : (
            results.map((r, i) => (
              <button key={i} onClick={() => { onSelectFile(r.path); onClose() }} className="w-full text-left px-3 py-2.5 hover:bg-bg-tertiary border-b border-border/50 last:border-0 flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-bg-surface border border-border flex items-center justify-center text-[11px] text-text-muted shrink-0">{mode === "files" ? "📄" : mode === "text" ? "⌕" : "◈"}</span>
                <span className="text-[12px] font-mono text-text-primary truncate flex-1">{r.path}</span>
                {r.preview && <span className="text-[11px] text-text-muted truncate max-w-[280px] hidden sm:inline">{r.preview.slice(0, 80)}</span>}
              </button>
            ))
          )}
        </div>
        <div className="px-3 py-2 border-t border-border flex items-center gap-2 text-[11px] text-text-muted">
          <span>Enter to open •</span>
          <span className="hidden sm:inline">Inserts <code className="px-1 py-0.5 rounded bg-bg-surface border border-border">@path</code> into input</span>
          <span className="ml-auto">{results.length} results</span>
        </div>
      </div>
    </div>
  )
}
