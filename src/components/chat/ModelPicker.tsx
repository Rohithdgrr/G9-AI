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
  const [freeOnly, setFreeOnly] = useState(true)
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

  const isFree = (m: ModelInfo) => m.cost.input === 0 && m.cost.output === 0

  const filtered = models.filter((m) => {
    if (freeOnly && !isFree(m)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.providerID.toLowerCase().includes(q) || m.modelID.toLowerCase().includes(q)
  })

  const grouped = new Map<string, ModelInfo[]>()
  for (const m of filtered) {
    const arr = grouped.get(m.providerID) || []
    arr.push(m)
    grouped.set(m.providerID, arr)
  }

  const current = selectedModel
    ? models.find((x) => x.providerID === selectedModel.providerID && x.modelID === selectedModel.modelID) || null
    : null
  const currentLabel = current ? current.name : selectedModel?.modelID || "Select model"
  const currentProvider = current?.providerID || selectedModel?.providerID || "opencode"

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded border font-mono text-[11px] ${open ? "bg-accent border-accent text-white" : "bg-bg-surface border-border text-text-primary hover:bg-bg-hover"}`}
        title={`${currentProvider}/${currentLabel} — click to change (⌘M)`}
      >
        <span className="text-[11px]">▣</span>
        <span className="truncate max-w-[180px]">{currentProvider}/{currentLabel}</span>
        <span className="text-[9px] px-1 py-0.5 rounded bg-success text-white font-bold">FREE</span>
        <span className="text-[10px]">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-[420px] max-w-[92vw] border border-border bg-bg-secondary shadow-soft overflow-hidden z-[100] animate-fadeIn font-mono">
          <div className="p-2.5 border-b border-border bg-bg-panel">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-semibold text-text-primary">Choose Model</span>
              <span className="text-text-muted">{filtered.length} free{freeOnly ? "" : ` / ${models.length}`}</span>
              <kbd className="ml-auto text-[10px] px-1 py-0.5 rounded border border-border bg-bg-surface text-text-muted">⌘M</kbd>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-[11px]">⌕</span>
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full pl-7 pr-2 py-1.5 rounded border border-border bg-bg-surface text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/30"
                />
              </div>
              <label className={`flex items-center gap-1 px-2 py-1.5 rounded border text-[10px] cursor-pointer ${freeOnly ? "bg-success-soft border-success/20 text-success" : "bg-bg-surface border-border text-text-muted"}`}>
                <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} className="w-3 h-3 accent-success" />
                Free only
              </label>
            </div>
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {loading && models.length === 0 && (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-600 rounded-full animate-spin mx-auto" />
                <div className="text-[12px] text-text-muted mt-2">Loading models…</div>
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="p-8 text-center">
                <div className="text-[13px] font-medium text-text-secondary">{search ? `No matches for "${search}"` : "No models available"}</div>
                <div className="text-[11px] text-text-muted mt-1">Try disabling “Free only”</div>
              </div>
            )}
            {Array.from(grouped.entries()).map(([providerID, providerModels]) => (
              <div key={providerID}>
                <div className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted border-b border-border/60 bg-bg-tertiary/70 sticky top-0 backdrop-blur flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> {providerID} <span className="ml-auto text-[10px] font-medium normal-case tracking-normal bg-bg-surface border border-border px-1.5 py-0.5 rounded-full">{providerModels.length}</span>
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
                      className={`w-full text-left px-3.5 py-3 flex items-center gap-3 hover:bg-bg-tertiary transition-colors border-b border-border/30 last:border-0 ${active ? "bg-violet-500/10 hover:bg-violet-500/10" : ""}`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ring-2 ${active ? "bg-violet-600 ring-violet-600/20" : free ? "bg-success ring-success/20" : "bg-text-muted/30 ring-transparent"}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] font-semibold truncate ${active ? "text-violet-600" : "text-text-primary"}`}>{m.name}</div>
                        <div className="text-[11px] text-text-muted truncate font-mono">{m.modelID}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.reasoning && <span className="text-[9px] px-1.5 py-1 rounded-full bg-violet-500/10 text-violet-600 border border-violet-500/20 font-semibold">reason</span>}
                        {m.toolcall && <span className="text-[9px] px-1.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-semibold">tools</span>}
                        {free ? (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-success text-white font-bold">FREE</span>
                        ) : (
                          <span className="text-[10px] text-text-muted font-mono">${m.cost.input}/{m.cost.output}</span>
                        )}
                      </div>
                      {active && <span className="text-violet-600 text-[13px] font-bold">✓</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="p-2.5 bg-bg-tertiary/50 border-t border-border flex items-center justify-between">
            <button onClick={() => { setModel({ providerID: "opencode", modelID: "mimo-v2.5-free" }); setOpen(false); setSearch("") }} className="text-[12px] font-medium text-text-muted hover:text-violet-600 px-3 py-1.5 rounded-xl hover:bg-bg-surface border border-transparent hover:border-border transition-colors">
              ↺ Reset to MiMo V2.5 Free
            </button>
            <span className="text-[11px] text-text-muted font-medium">{filtered.length} models</span>
          </div>
        </div>
      )}
    </div>
  )
}
