import { useEffect, useState } from "react"
import { getClient } from "../../sdk/client"

export function VcsStatus({ compact }: { compact?: boolean }) {
  const [branch, setBranch] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const c = getClient()
        const v = await c.vcs.get()
        if (cancelled) return
        const d = v.data as { branch?: string; status?: string; ahead?: number; behind?: number }
        if (d) { setBranch(d.branch || null); setStatus(d.status || null) }
      } catch {}
      try {
        const c = getClient()
        const f = await c.file.status()
        if (cancelled) return
        const files = f.data as Array<{ path: string; status?: string }>
        if (files && files.length) setStatus(`${files.length} changed`)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  if (compact) {
    return <span className="inline-flex items-center gap-1 text-[11px] text-text-muted"><span className="w-1.5 h-1.5 rounded-full bg-success" />{branch || "main"}</span>
  }

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="px-1.5 py-0.5 rounded-full bg-success-soft border border-success/20 text-success font-medium flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-success" /> {branch || "main"}
      </span>
      {status && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/15 text-amber-600">{status}</span>}
    </div>
  )
}

export function DiffView({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [diff, setDiff] = useState<Array<{ file: string; before: string; after: string; additions: number; deletions: number }> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const c = getClient()
        const r = await c.session.diff({ path: { id: sessionId } })
        setDiff((r.data as unknown as Array<{ file: string; before: string; after: string; additions: number; deletions: number }>) || [])
      } catch { setDiff([]) }
      setLoading(false)
    })()
  }, [sessionId])

  return (
    <div className="fixed inset-0 z-[55] flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-[720px] h-full bg-bg-secondary border-l border-border flex flex-col animate-slideIn">
        <div className="h-12 px-4 flex items-center gap-3 border-b border-border shrink-0">
          <span className="text-[13px] font-semibold text-text-primary">Session Diff</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-accent-soft border border-accent/20 text-accent">{diff?.length || 0} files</span>
          <button onClick={onClose} className="ml-auto w-7 h-7 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center text-text-muted hover:text-text-primary">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center text-[12px] text-text-muted py-8">Loading diff…</div>
          ) : !diff || diff.length === 0 ? (
            <div className="text-center text-[12px] text-text-muted py-8 border border-dashed border-border rounded-xl">No changes in this session</div>
          ) : (
            diff.map((f) => (
              <div key={f.file} className="rounded-xl border border-border bg-bg-tertiary/50 overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2 border-b border-border">
                  <span className="text-[11px] font-mono font-medium text-text-primary truncate">{f.file}</span>
                  <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded-full bg-success-soft border border-success/15 text-success">+{f.additions}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-error-soft border border-error/15 text-error">-{f.deletions}</span>
                </div>
                <div className="grid grid-cols-2 gap-px bg-border">
                  <div className="bg-[#0f0f12] p-3 max-h-[320px] overflow-auto">
                    <div className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-1">Before</div>
                    <pre className="text-[11px] leading-5 font-mono whitespace-pre-wrap text-text-secondary">{f.before.slice(0, 4000) || "(empty)"}</pre>
                  </div>
                  <div className="bg-[#0f0f12] p-3 max-h-[320px] overflow-auto">
                    <div className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-1">After</div>
                    <pre className="text-[11px] leading-5 font-mono whitespace-pre-wrap text-text-secondary">{f.after.slice(0, 4000) || "(empty)"}</pre>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
