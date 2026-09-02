import { useEffect, useState } from "react"
import { useConnectionStore } from "../../stores/connection"
import { useSettingsStore } from "../../stores/settings"
import { getClient, getServerUrl } from "../../sdk/client"

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { status, serverUrl, health } = useConnectionStore()
  const { theme, setTheme, fontSize, setFontSize, density, setDensity, selectedModel, setModel, providers, loadProviders } = useSettingsStore()
  const [mcp, setMcp] = useState<Record<string, unknown> | null>(null)
  const [vcs, setVcs] = useState<{ branch?: string; ahead?: number; behind?: number; status?: string } | null>(null)
  const [projectPath, setProjectPath] = useState<string>("")
  const [newMcpName, setNewMcpName] = useState("")
  const [newMcpCmd, setNewMcpCmd] = useState("")

  useEffect(() => {
    if (!open) return
    loadProviders()
    ;(async () => {
      try {
        const c = getClient()
        const pr = await c.path.get()
        const d = pr.data as { worktree?: string; directory?: string; worktreeID?: string }
        if (d) setProjectPath(d.worktree || (d as { directory?: string }).directory || "")
      } catch {}
      try {
        const c = getClient()
        const res = await c.mcp.status()
        setMcp((res.data as Record<string, unknown>) || {})
      } catch { setMcp({}) }
      try {
        const c = getClient()
        const v = await c.vcs.get()
        setVcs(v.data as { branch?: string })
      } catch {}
    })()
  }, [open, loadProviders])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[6px]" onClick={onClose} />
      <div className="relative w-full max-w-[860px] max-h-[86vh] bg-bg-secondary border border-border rounded-[16px] shadow-soft flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="h-14 px-6 flex items-center gap-3 border-b border-border shrink-0 bg-bg-panel">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-display font-bold text-[13px]">ग</div>
          <div>
            <div className="text-[14px] font-semibold text-text-primary font-display leading-none">Settings</div>
            <div className="text-[11px] text-text-muted">Manuscript preferences · live</div>
          </div>
          <span className="ml-2 text-[10px] tracking-widest uppercase px-2 py-1 rounded-full bg-accent-soft border border-accent/15 text-accent">Temple</span>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-full bg-bg-surface border border-border hover:border-accent/30 hover:bg-bg-hover text-text-muted hover:text-text-primary flex items-center justify-center">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Server */}
            <section className="rounded-xl border border-border bg-bg-tertiary/40 p-4">
              <h3 className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-accent" /> Server</h3>
              <div className="space-y-2.5 text-[12px]">
                <div className="flex items-center justify-between gap-3"><span className="text-text-muted">URL</span><span className="font-mono text-[11px] text-text-primary truncate">{serverUrl || getServerUrl() || "—"}</span></div>
                <div className="flex items-center justify-between"><span className="text-text-muted">Status</span><span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${status === "connected" ? "bg-success-soft border-success/20 text-success" : "bg-error-soft border-error/20 text-error"}`}>{status}</span></div>
                <div className="flex items-center justify-between"><span className="text-text-muted">Version</span><span className="font-mono text-text-secondary">{health?.version || "unknown"}</span></div>
                <div className="flex items-center justify-between"><span className="text-text-muted">Health</span><span className={`w-2 h-2 rounded-full ${status === "connected" ? "bg-success" : "bg-error"}`} /></div>
                <div className="pt-2 flex items-center gap-2">
                  <button onClick={async () => { try { const c = getClient(); const r = await c.global.event(); void r } catch {} }} className="text-[11px] px-3 py-1.5 rounded-full bg-bg-surface border border-border hover:border-accent/20">Test SSE</button>
                  <span className="text-[10px] text-text-muted">CORS <code className="px-1.5 py-0.5 rounded bg-bg-surface border border-border">--cors http://localhost:1420</code></span>
                </div>
              </div>
            </section>

            {/* Model */}
            <section className="rounded-xl border border-border bg-bg-tertiary/40 p-4">
              <h3 className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-accent" /> Model & Agent</h3>
              <div className="text-[11px] text-text-muted mb-2 leading-relaxed">Only <span className="text-success font-semibold">FREE</span> models — any API key works. Agent fixed to <code className="px-1 py-0.5 rounded bg-bg-surface border border-border">build</code>.</div>
              <select
                value={selectedModel ? `${selectedModel.providerID}/${selectedModel.modelID}` : ""}
                onChange={(e) => {
                  const v = e.target.value
                  if (!v) setModel(null)
                  else { const [providerID, ...rest] = v.split("/"); const modelID = rest.join("/"); setModel({ providerID, modelID }) }
                }}
                className="w-full px-3 py-2.5 rounded-lg bg-bg-surface border border-border text-[12px] text-text-primary focus:outline-none focus:border-accent/30 font-mono"
              >
                <option value="">Auto (server default)</option>
                {providers.map((p) => (
                  <option key={`${p.providerID}/${p.modelID}`} value={`${p.providerID}/${p.modelID}`}>{p.name}</option>
                ))}
              </select>
              <div className="text-[11px] text-text-muted mt-2">{providers.length ? `${providers.length} models available` : "No providers — configure in OpenCode TUI"}</div>
            </section>

            {/* Appearance */}
            <section className="rounded-xl border border-border bg-bg-tertiary/40 p-4">
              <h3 className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-accent" /> Appearance</h3>
              <div className="grid grid-cols-3 gap-2">
                {(["dark", "light", "system"] as const).map((t) => (
                  <button key={t} onClick={() => setTheme(t)} className={`px-3 py-2.5 rounded-lg border text-[12px] font-medium capitalize transition-colors ${theme === t ? "bg-accent text-white border-accent" : "bg-bg-surface border-border text-text-secondary hover:border-accent/20"}`}>{t}</button>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[11px] text-text-muted w-16">Font size</span>
                <input type="range" min={12} max={16} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="flex-1 accent-accent" />
                <span className="text-[11px] font-mono px-2 py-1 rounded bg-bg-surface border border-border w-12 text-center">{fontSize}px</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] text-text-muted">Density</span>
                <div className="ml-auto flex gap-1">
                  {(["comfortable", "compact"] as const).map((d) => (
                    <button key={d} onClick={() => setDensity(d)} className={`px-3 py-1 rounded-full border text-[11px] capitalize ${density === d ? "bg-accent-soft border-accent/20 text-accent" : "bg-bg-surface border-border text-text-muted"}`}>{d}</button>
                  ))}
                </div>
              </div>
            </section>

            {/* Project & VCS */}
            <section className="rounded-xl border border-border bg-bg-tertiary/40 p-4">
              <h3 className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-3 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-accent" /> Project & VCS</h3>
              <div className="text-[12px] space-y-2">
                <div className="flex items-center justify-between gap-2"><span className="text-text-muted shrink-0">Worktree</span><span className="font-mono text-[11px] text-text-secondary truncate max-w-[320px] text-right">{projectPath || "—"}</span></div>
                <div className="flex items-center justify-between"><span className="text-text-muted">Branch</span><span className="font-mono text-[11px] text-text-primary">{(vcs as { branch?: string })?.branch || "unknown"}</span></div>
                <button
                  onClick={async () => {
                    try {
                      const c = getClient()
                      const sid = (document.querySelector("[data-active-session]") as HTMLElement)?.dataset.activeSession
                      if (sid) {
                        const diff = await c.session.diff({ path: { id: sid } })
                        alert(`Diff: ${JSON.stringify(diff.data, null, 2).slice(0, 800)}`)
                      } else alert("No active session")
                    } catch (e) { alert(String(e)) }
                  }}
                  className="mt-1 text-[11px] px-3 py-1.5 rounded-full bg-bg-surface border border-border hover:border-accent/20"
                >
                  Show session diff
                </button>
              </div>
            </section>

            {/* MCP — span 2 */}
            <section className="lg:col-span-2 rounded-xl border border-border bg-bg-tertiary/40 p-4">
              <h3 className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-2 flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-accent" /> MCP Servers</h3>
              <div className="text-[11px] text-text-muted mb-2">{mcp ? `${Object.keys(mcp).length} server(s)` : "loading…"}</div>
              {mcp && Object.keys(mcp).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[160px] overflow-auto pr-1">
                  {Object.entries(mcp).map(([name, info]) => (
                    <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface border border-border">
                      <span className="text-[12px] font-medium text-text-primary">{name}</span>
                      <span className="text-[11px] text-text-muted truncate flex-1">{JSON.stringify(info).slice(0, 80)}</span>
                      <span className="w-2 h-2 rounded-full bg-success" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-text-muted rounded-lg border border-dashed border-border p-4 text-center">No MCP servers connected</div>
              )}
              <div className="mt-3 grid grid-cols-[160px_1fr_auto] gap-2">
                <input value={newMcpName} onChange={(e) => setNewMcpName(e.target.value)} placeholder="name" className="px-2.5 py-2 rounded-lg bg-bg-surface border border-border text-[11px] font-mono" />
                <input value={newMcpCmd} onChange={(e) => setNewMcpCmd(e.target.value)} placeholder='{"command":"npx","args":["-y","..."]}' className="px-2.5 py-2 rounded-lg bg-bg-surface border border-border text-[11px] font-mono" />
                <button
                  onClick={async () => {
                    if (!newMcpName || !newMcpCmd) return
                    try {
                      const cfg = JSON.parse(newMcpCmd)
                      const c = getClient()
                      await c.mcp.add({ body: { name: newMcpName, config: cfg } })
                      const r = await c.mcp.status()
                      setMcp((r.data as Record<string, unknown>) || {})
                      setNewMcpName(""); setNewMcpCmd("")
                    } catch (e) { alert(String(e)) }
                  }}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-[11px] font-semibold hover:bg-accent-hover"
                >
                  Add
                </button>
              </div>
            </section>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-text-muted border-t border-border pt-4">
            <span>Shortcuts:</span><code className="px-1.5 py-0.5 rounded bg-bg-surface border border-border">Ctrl+,</code> settings · <code className="px-1.5 py-0.5 rounded bg-bg-surface border border-border">Ctrl+N</code> new · <code className="px-1.5 py-0.5 rounded bg-bg-surface border border-border">Ctrl+K</code> search · <code className="px-1.5 py-0.5 rounded bg-bg-surface border border-border">Esc</code> abort
          </div>
        </div>
      </div>
    </div>
  )
}
