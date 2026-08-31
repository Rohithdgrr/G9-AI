import { useConnectionStore } from "../../stores/connection"

export function NotificationToast() {
  const notifications = useConnectionStore((s) => s.notifications)
  const removeNotification = useConnectionStore((s) => s.removeNotification)

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-3 right-3 z-[200] flex flex-col gap-2 max-w-[400px]">
      {notifications.map((n) => {
        const colors = n.type === "error"
          ? "bg-error/10 border-error/30 text-error"
          : n.type === "success"
            ? "bg-success/10 border-success/30 text-success"
            : "bg-accent-soft border-accent/20 text-accent"
        const icon = n.type === "error" ? "✕" : n.type === "success" ? "✓" : "ℹ"
        return (
          <div key={n.id} className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border backdrop-blur-md shadow-lg ${colors} animate-slideIn`}>
            <span className="mt-px text-[12px] font-bold shrink-0">{icon}</span>
            <span className="text-[12px] leading-snug flex-1 break-words">{n.text}</span>
            <button onClick={() => removeNotification(n.id)} className="shrink-0 text-[12px] opacity-60 hover:opacity-100">✕</button>
          </div>
        )
      })}
    </div>
  )
}
