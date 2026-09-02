import { useEffect, useRef } from "react"
import { useMessageStore } from "../../stores/message"
import { MessageBubble } from "./MessageBubble"
import { TypingIndicator } from "./TypingIndicator"
export function ChatContainer({ sessionId }: { sessionId: string }) {
  const messages = useMessageStore((s) => s.messages.get(sessionId) || [])
  const streaming = useMessageStore((s) => s.streaming.get(sessionId))
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = ref.current; if (!el) return; const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160; if (nearBottom) el.scrollTop = el.scrollHeight }, [messages, streaming?.active])
  if (messages.length === 0) return <div className="flex-1 flex items-center justify-center p-8 bg-bg-primary"><div className="text-center max-w-[460px]"><div className="text-[11px] tracking-widest uppercase text-accent mb-2">Temple manuscript</div><h2 className="font-display text-[22px] font-semibold">What shall we inscribe?</h2><p className="text-[12px] text-text-muted mt-1">Ask about your codebase, request edits, or run tasks.</p></div></div>
  const showTyping = streaming?.active && !messages.some((m) => m.info.role === "assistant" && m.parts.some((p) => p.type === "text" && (p as any).text?.trim()))
  return <div ref={ref} className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-bg-primary">{messages.map((m, i) => <MessageBubble key={m.info.id || String(i)} msg={m} isStreaming={i === messages.length - 1 && m.info.role === "assistant" && !!streaming?.active} />)}{showTyping && <TypingIndicator />}</div>
}
