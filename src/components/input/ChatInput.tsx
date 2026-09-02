import { useRef, useState } from "react"
import { Send, Square } from "lucide-react"
import { useMessageStore } from "../../stores/message"
export function ChatInput({ sessionId }: { sessionId: string }) {
  const [text, setText] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)
  const sendMessage = useMessageStore((s) => s.sendMessage)
  const abortMessage = useMessageStore((s) => s.abortMessage)
  const streaming = useMessageStore((s) => s.streaming.get(sessionId))
  const onSend = async () => { const v = text.trim(); if (!v || streaming?.active) return; setText(""); if (ref.current) ref.current.style.height = "44px"; await sendMessage(sessionId, v) }
  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend() } if (e.key === "Escape" && streaming?.active) abortMessage(sessionId) }
  return (
    <div className="h-[80px] shrink-0 border-t border-border bg-bg-panel px-4 py-3">
      <div className="max-w-[760px] mx-auto flex items-end gap-2">
        <div className="flex-1 flex items-end gap-2 rounded-2xl border border-border bg-bg-secondary px-3 py-2 focus-within:border-accent/30">
          <textarea ref={ref} value={text} onChange={(e) => { setText(e.target.value); const el = e.target as HTMLTextAreaElement; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 100) + "px" }} onKeyDown={onKey} placeholder="Ask anything — Shift+Enter for newline" rows={1} className="flex-1 bg-transparent text-[13px] leading-5 text-text-primary placeholder:text-text-muted resize-none focus:outline-none min-h-[24px] py-1" style={{ height: 44 }} />
          {streaming?.active ? <button onClick={() => abortMessage(sessionId)} className="w-9 h-9 rounded-full bg-error text-white flex items-center justify-center shrink-0"><Square size={14} /></button> : <button onClick={onSend} disabled={!text.trim()} className="w-9 h-9 rounded-full bg-accent disabled:opacity-40 text-white flex items-center justify-center shrink-0"><Send size={14} /></button>}
        </div>
      </div>
      <div className="max-w-[760px] mx-auto mt-1 text-[10px] text-text-muted font-mono text-center">{streaming?.active ? "Streaming…" : "Connected to OpenCode"}</div>
    </div>
  )
}
