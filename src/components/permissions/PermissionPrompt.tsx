import { useState } from "react"
import { usePermissionStore, type Permission } from "../../stores/permission"

function PermissionCard({ perm }: { perm: Permission }) {
  const reply = usePermissionStore((s) => s.reply)
  const [busy, setBusy] = useState<null | string>(null)

  const handle = async (r: "once" | "always" | "reject") => {
    setBusy(r)
    try { await reply(perm.sessionID, perm.id, r) } finally { setBusy(null) }
  }

  const patterns = Array.isArray(perm.pattern) ? perm.pattern : perm.pattern ? [perm.pattern] : []
  const meta = perm.metadata as Record<string, unknown>
  const detail = (meta.command as string) || (meta.file as string) || (meta.path as string) || ""

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] backdrop-blur p-4 message-enter">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-600 text-[13px] shrink-0">⚠</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold tracking-widest uppercase text-amber-700 dark:text-amber-400">Permission Required</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-medium">{perm.type}</span>
            <span className="text-[11px] text-text-muted font-mono truncate">{perm.id.slice(0, 8)}</span>
          </div>
          <div className="text-[12px] font-semibold text-text-primary mt-1">{perm.title}</div>
          {detail && <div className="text-[11px] font-mono text-text-muted mt-1 truncate bg-[#0f0f12] border border-border rounded-lg px-2 py-1">{detail}</div>}
          {patterns.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {patterns.map((p) => (
                <span key={p} className="text-[11px] font-mono px-1.5 py-0.5 rounded-full bg-bg-surface border border-border text-text-secondary">{p}</span>
              ))}
            </div>
          )}
          <div className="text-[11px] text-text-muted mt-1">Session <span className="font-mono text-text-secondary">{perm.sessionID.slice(0, 8)}</span> • {new Date(perm.time.created).toLocaleTimeString()}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button disabled={!!busy} onClick={() => handle("once")} className="px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-[12px] font-semibold transition-colors flex items-center gap-1.5">
          {busy === "once" ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "✓"} Allow Once
        </button>
        <button disabled={!!busy} onClick={() => handle("always")} className="px-3.5 py-2 rounded-xl bg-success hover:bg-success/90 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors flex items-center gap-1.5">
          {busy === "always" ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "∞"} Allow Always
        </button>
        <button disabled={!!busy} onClick={() => handle("reject")} className="px-3.5 py-2 rounded-xl bg-bg-surface border border-border hover:border-error/30 hover:text-error disabled:opacity-50 text-text-secondary text-[12px] font-semibold transition-colors">✕ Deny</button>
        <span className="ml-auto text-[11px] text-text-muted hidden sm:inline">Always remembers pattern for this session</span>
      </div>
    </div>
  )
}

export function PermissionPrompt({ sessionId }: { sessionId?: string }) {
  const pending = usePermissionStore((s) => s.pending)
  const list = Array.from(pending.values()).filter((p) => !sessionId || p.sessionID === sessionId)
  if (list.length === 0) return null
  return (
    <div className="space-y-3">
      {list.map((p) => (
        <PermissionCard key={p.id} perm={p} />
      ))}
    </div>
  )
}
