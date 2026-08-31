import { useState } from "react"
import { useConnectionStore } from "../../stores/connection"

export function ConnectionScreen() {
  const [url, setUrl] = useState("http://localhost:4096")
  const [password, setPassword] = useState("")
  const { status, error, connect } = useConnectionStore()

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    // Try Tauri auto-start first (if in desktop, this will spawn opencode if not running)
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      await invoke("ensure_opencode_server", { port: 4096 }).catch(() => {})
      await new Promise((r) => setTimeout(r, 600))
    } catch {}
    await connect(url, password || undefined)
  }

  return (
    <div className="flex items-center justify-center h-full bg-bg-primary relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute -top-32 -left-32 w-[520px] h-[520px] bg-accent/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[560px] h-[560px] bg-violet-500/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-500/[0.04] rounded-full blur-[60px] pointer-events-none" />

      <div className="w-full max-w-[440px] mx-4 relative">
        {/* Logo + title */}
        <div className="text-center mb-7 animate-fadeIn">
          <div className="w-[68px] h-[68px] mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-glow animate-float relative">
            <span className="text-[30px] font-black text-white tracking-tighter">G</span>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/12 to-transparent pointer-events-none" />
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-text-primary">Ganesha</h1>
          <p className="text-[13px] text-text-secondary mt-1.5 tracking-wide">OpenCode Single-Agent Chat • Minimal • Fast</p>
          <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-success-soft border border-success/20 text-[11px] font-medium text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> OpenCode v1.18.25 • 212 providers
          </div>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl p-7 shadow-soft animate-fadeIn" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-accent-soft border border-accent/20 flex items-center justify-center text-accent text-[13px]">◈</div>
            <h2 className="text-[13px] font-semibold tracking-wide text-text-primary uppercase">Connect to Server</h2>
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-bg-surface border border-border text-text-muted">Tauri • 0.1.0</span>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase text-text-muted mb-2">
                Server URL
                <span className="ml-auto font-normal normal-case tracking-normal text-[11px] bg-success-soft text-success px-1.5 py-0.5 rounded border border-success/15">proxy: /global/health ✓</span>
              </label>
              <div className="relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">↗</span>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full pl-8 pr-3 py-3 bg-bg-tertiary border border-border rounded-xl text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-4 focus:ring-accent/10 transition-all"
                  placeholder="http://localhost:4096"
                />
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">Vite proxies <code className="px-1 py-0.5 rounded bg-bg-surface border border-border text-[11px]">/global</code> → <code className="px-1 py-0.5 rounded bg-bg-surface border border-border text-[11px]">:4096</code> to avoid CORS.</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold tracking-widest uppercase text-text-muted mb-2">
                Password <span className="font-normal normal-case tracking-normal text-text-muted">(optional)</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-3 bg-bg-tertiary border border-border rounded-xl text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-4 focus:ring-accent/10 transition-all"
                placeholder="Leave empty if no auth"
              />
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-error-soft border border-error/20 text-[12px] leading-relaxed text-error whitespace-pre-wrap animate-fadeIn">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "connecting"}
              className="w-full py-3 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-[13px] font-semibold tracking-wide shadow-glow transition-all flex items-center justify-center gap-2"
            >
              {status === "connecting" ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Connecting…
                </>
              ) : (
                <>Connect <span className="text-white/70">→</span></>
              )}
            </button>
          </form>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { k: "Sessions", v: "Chat" },
              { k: "Streaming", v: "SSE" },
              { k: "Auth", v: "Keyring" },
            ].map((x) => (
              <div key={x.k} className="rounded-xl bg-bg-tertiary border border-border p-2.5 text-center">
                <div className="text-[10px] tracking-widest uppercase text-text-muted font-semibold">{x.k}</div>
                <div className="text-[12px] font-medium text-text-secondary mt-0.5">{x.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-text-muted">
            <code className="px-2 py-1 rounded-lg bg-bg-tertiary border border-border">auto-starts via Tauri • no manual serve needed</code>
          </div>
        </div>

        <p className="text-center text-[11px] text-text-muted mt-4">No data leaves your machine • Local-first • <span className="text-text-secondary">Press Enter to connect</span></p>
      </div>
    </div>
  )
}
