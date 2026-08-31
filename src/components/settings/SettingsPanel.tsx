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
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-[560px] h-full bg-bg-secondary border-l border-border shadow-soft flex flex-col animate-slideIn">
        <div className="h-12 px-4 flex items-center gap-3 border-b border-border shrink-0">
          <span className="text-[13px] font-semibold text-text-primary">Settings</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-accent-soft border border-accent/20 text-accent">Phase 5</span>
          <button onClick={onClose} className="ml-auto w-7 h-7 rounded-lg bg-bg-tertiary border border-border hover:border-accent/20 text-text-muted hover:text-text-primary flex items-center justify-center">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Server */}
          <section className="rounded-2xl border border-border bg-bg-tertiary/50 p-4">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-3">Server</h3>
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between"><span className="text-text-muted">URL</span><span className="font-mono text-text-primary">{serverUrl || getServerUrl() || "—"}</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted">Status</span><span className={`px-1.5 py-0.5 rounded-full border text-[11px] font-medium ${status === "connected" ? "bg-success-soft border-success/20 text-success" : "bg-error-soft border-error/20 text-error"}`}>{status}</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted">Version</span><span className="font-mono text-text-secondary">{health?.version || "unknown"}</span></div>
              <div className="flex items-center justify-between"><span className="text-text-muted">Health</span><span className={`w-2 h-2 rounded-full ${status === "connected" ? "bg-success" : "bg-error"}`} /></div>
              <div className="pt-2 flex gap-2">
                <button onClick={async () => { try { const c = getClient(); const r = await c.global.event(); void r } catch {} }} className="text-[11px] px-2 py-1 rounded-lg bg-bg-surface border border-border hover:border-accent/20">Test SSE</button>
                <span className="text-[11px] text-text-muted self-center">CORS: <code className="px-1 py-0.5 rounded bg-bg-surface border border-border">--cors http://localhost:1420</code></span>
              </div>
            </div>
          </section>

          {/* Model */}
          <section className="rounded-2xl border border-border bg-bg-tertiary/50 p-4">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-3">Model & Agent</h3>
            <div className="text-[11px] text-text-muted mb-2">Selected model is sent with each prompt. Agent is fixed to <code className="px-1 py-0.5 rounded bg-bg-surface border border-border">build</code>.</div>
            <select
              value={selectedModel ? `${selectedModel.providerID}/${selectedModel.modelID}` : ""}
              onChange={(e) => {
                const v = e.target.value
                if (!v) setModel(null)
                else { const [providerID, ...rest] = v.split("/"); const modelID = rest.join("/"); setModel({ providerID, modelID }) }
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-surface border border-border text-[12px] text-text-primary focus:outline-none focus:border-accent/30"
            >
              <option value="">Auto (server default)</option>
              {providers.map((p) => (
                <option key={`${p.providerID}/${p.modelID}`} value={`${p.providerID}/${p.modelID}`}>{p.name}</option>
              ))}
            </select>
            <div className="text-[11px] text-text-muted mt-2">{providers.length ? `${providers.length} models available` : "No providers yet — configure in OpenCode TUI or via API"}</div>
          </section>

          {/* Appearance */}
          <section className="rounded-2xl border border-border bg-bg-tertiary/50 p-4">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-3">Appearance</h3>
            <div className="grid grid-cols-3 gap-2">
              {(["dark", "light", "system"] as const).map((t) => (
                <button key={t} onClick={() => setTheme(t)} className={`px-3 py-2.5 rounded-xl border text-[12px] font-medium capitalize transition-colors ${theme === t ? "bg-accent text-white border-accent" : "bg-bg-surface border-border text-text-secondary hover:border-accent/20"}`}>{t}</button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[11px] text-text-muted">Font size</span>
              <input type="range" min={12} max={16} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="flex-1" />
              <span className="text-[11px] font-mono px-2 py-1 rounded bg-bg-surface border border-border">{fontSize}px</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-text-muted">Density</span>
              <div className="ml-auto flex gap-1">
                {(["comfortable", "compact"] as const).map((d) => (
                  <button key={d} onClick={() => setDensity(d)} className={`px-2.5 py-1 rounded-full border text-[11px] capitalize ${density === d ? "bg-accent-soft border-accent/20 text-accent" : "bg-bg-surface border-border text-text-muted"}`}>{d}</button>
                ))}
              </div>
            </div>
          </section>

          {/* Project & VCS */}
          <section className="rounded-2xl border border-border bg-bg-tertiary/50 p-4">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-3">Project & VCS</h3>
            <div className="text-[12px] space-y-2">
              <div className="flex items-center justify-between"><span className="text-text-muted">Worktree</span><span className="font-mono text-[11px] text-text-secondary truncate max-w-[280px]">{projectPath || "—"}</span></div>
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
                className="mt-1 text-[11px] px-2.5 py-1 rounded-full bg-bg-surface border border-border hover:border-accent/20"
              >
                Show session diff
              </button>
            </div>
          </section>

          {/* MCP */}
          <section className="rounded-2xl border border-border bg-bg-tertiary/50 p-4">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-text-muted mb-2">MCP Servers</h3>
            <div className="text-[11px] text-text-muted mb-2">{mcp ? `${Object.keys(mcp).length} server(s)` : "loading…"}</div>
            {mcp && Object.keys(mcp).length > 0 ? (
              <div className="space-y-1.5 max-h-[160px] overflow-auto">
                {Object.entries(mcp).map(([name, info]) => (
                  <div key={name} className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-bg-surface border border-border">
                    <span className="text-[12px] font-medium text-text-primary">{name}</span>
                    <span className="text-[11px] text-text-muted truncate flex-1">{JSON.stringify(info).slice(0, 80)}</span>
                    <span className="w-2 h-2 rounded-full bg-success" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-text-muted rounded-xl border border-dashed border-border p-3 text-center">No MCP servers connected</div>
            )}
            <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
              <input value={newMcpName} onChange={(e) => setNewMcpName(e.target.value)} placeholder="name" className="px-2 py-1.5 rounded-lg bg-bg-surface border border-border text-[11px] font-mono" />
              <input value={newMcpCmd} onChange={(e) => setNewMcpCmd(e.target.value)} placeholder='{"command":"npx","args":["-y","..."]}' className="px-2 py-1.5 rounded-lg bg-bg-surface border border-border text-[11px] font-mono" />
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
                className="px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] font-semibold"
              >
                Add
              </button>
            </div>
          </section>

          <div className="text-[11px] text-text-muted text-center">Shortcuts: <code className="px-1 py-0.5 rounded bg-bg-surface border border-border">Ctrl+,</code> settings • <code className="px-1 py-0.5 rounded bg-bg-surface border border-border">Ctrl+N</code> new • <code className="px-1 py-0.5 rounded bg-bg-surface border border-border">Ctrl+K</code> search • <code className="px-1 py-0.5 rounded bg-bg-surface border border-border">Esc</code> abort</div>
        </div>
      </div>
    </div>
  )
}
