import { useState, useRef, useEffect, useCallback } from "react"
import { useSettingsStore } from "../../stores/settings"
import { getClient } from "../../sdk/client"

interface ModelInfo {
  providerID: string
  modelID: string
  name: string
  cost: { input: number; output: number }
  reasoning: boolean
  toolcall: boolean
  attachment: boolean
}

export function ModelPicker() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedModel = useSettingsStore((s) => s.selectedModel)
  const setModel = useSettingsStore((s) => s.setModel)

  const fetchModels = useCallback(async () => {
    if (models.length > 0) return
    setLoading(true)
    try {
      const c = getClient()
      const dir = (() => { try { return localStorage.getItem("ganesha:directory") } catch { return null } })()
      const headers: Record<string, string> = {}
      if (dir) headers["x-opencode-directory"] = encodeURIComponent(dir)
      const r = await fetch("/config/providers", { headers })
      if (r.ok) {
        const j = await r.json() as {
          providers?: Array<{ id: string; models?: Record<string, { id: string; name: string; cost: { input: number; output: number }; capabilities: { reasoning?: boolean; toolcall?: boolean; attachment?: boolean }; status: string }> }>
        }
        const list: ModelInfo[] = []
        for (const p of j.providers || []) {
          if (!p.models) continue
          for (const mid of Object.keys(p.models)) {
            const m = p.models[mid]
            if (m.status !== "active") continue
            list.push({
              providerID: p.id,
              modelID: mid,
              name: m.name || mid,
              cost: m.cost || { input: 0, output: 0 },
              reasoning: !!m.capabilities?.reasoning,
              toolcall: !!m.capabilities?.toolcall,
              attachment: !!m.capabilities?.attachment,
            })
          }
        }
        // Sort: free first, then by provider, then name
        list.sort((a, b) => {
          const aFree = a.cost.input === 0 && a.cost.output === 0
          const bFree = b.cost.input === 0 && b.cost.output === 0
          if (aFree !== bFree) return aFree ? -1 : 1
          if (a.providerID !== b.providerID) return a.providerID.localeCompare(b.providerID)
          return a.name.localeCompare(b.name)
        })
        setModels(list)
      }
    } catch {}
    setLoading(false)
  }, [models.length])

  useEffect(() => {
    if (open) {
      fetchModels()
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, fetchModels])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "m" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const filtered = models.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.providerID.toLowerCase().includes(q) || m.modelID.toLowerCase().includes(q)
  })

  // Group by provider
  const grouped = new Map<string, ModelInfo[]>()
  for (const m of filtered) {
    const arr = grouped.get(m.providerID) || []
    arr.push(m)
    grouped.set(m.providerID, arr)
  }

  const currentLabel = selectedModel
    ? (() => {
        const m = models.find((x) => x.providerID === selectedModel.providerID && x.modelID === selectedModel.modelID)
        return m ? `${m.providerID}/${m.name}` : selectedModel.modelID
      })()
    : null

  const isFree = (m: ModelInfo) => m.cost.input === 0 && m.cost.output === 0

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-bg-surface border border-border text-[11px] font-medium text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors max-w-[200px] truncate"
        title={`Current model: ${currentLabel || "server default"} — click to change`}
      >
        <span className="text-accent text-[10px]">●</span>
        <span className="truncate">{currentLabel || "default"}</span>
        <svg className="w-3 h-3 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-[360px] rounded-2xl border border-border bg-bg-secondary shadow-lg overflow-hidden z-50 animate-fadeIn">
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[13px] font-semibold text-text-primary">Model</span>
              <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-bg-surface border border-border text-text-muted">⌘M</kbd>
            </div>
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models…"
              className="w-full px-3 py-2 rounded-xl bg-bg-surface border border-border text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/30"
            />
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {loading && models.length === 0 && (
              <div className="p-6 text-center text-[12px] text-text-muted">Loading models…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="p-6 text-center text-[12px] text-text-muted">
                {search ? "No matches" : "No models available"}
              </div>
            )}
            {Array.from(grouped.entries()).map(([providerID, providerModels]) => (
              <div key={providerID}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border/50 bg-bg-surface/50 sticky top-0">
                  {providerID}
                </div>
                {providerModels.map((m) => {
                  const active = selectedModel?.providerID === m.providerID && selectedModel?.modelID === m.modelID
                  const free = isFree(m)
                  return (
                    <button
                      key={`${m.providerID}/${m.modelID}`}
                      onClick={() => {
                        setModel({ providerID: m.providerID, modelID: m.modelID })
                        setOpen(false)
                        setSearch("")
                      }}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-bg-tertiary transition-colors ${active ? "bg-accent-soft" : ""}`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${active ? "bg-accent" : free ? "bg-success" : "bg-text-muted/30"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-text-primary truncate">{m.name}</div>
                        <div className="text-[10px] text-text-muted truncate">{m.modelID}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {m.reasoning && <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">reason</span>}
                        {m.toolcall && <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">tools</span>}
                        {m.attachment && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">attach</span>}
                        {free ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-semibold">FREE</span>
                        ) : (
                          <span className="text-[9px] text-text-muted">${m.cost.input}/{m.cost.output}</span>
                        )}
                      </div>
                      {active && <span className="text-accent text-[10px]">✓</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-border flex items-center justify-between">
            <button onClick={() => { setModel({ providerID: "opencode", modelID: "mimo-v2.5-free" }); setOpen(false); setSearch("") }} className="text-[11px] text-text-muted hover:text-text-primary px-2 py-1 rounded-lg hover:bg-bg-tertiary transition-colors">
              Reset to default
            </button>
            <span className="text-[10px] text-text-muted">{filtered.length} models</span>
          </div>
        </div>
      )}
    </div>
  )
}
