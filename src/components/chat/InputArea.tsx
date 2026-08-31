import { useState, useRef, useEffect } from "react"
import { useMessageStore } from "../../stores/message"
import { getClient } from "../../sdk/client"
import { ModelPicker } from "./ModelPicker"

export function InputArea({ sessionId, onSelectFile }: { sessionId: string; onSelectFile?: (path: string) => void }) {
  const [text, setText] = useState("")
  const [fileResults, setFileResults] = useState<string[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendMessage = useMessageStore((s) => s.sendMessage)
  const abortMessage = useMessageStore((s) => s.abortMessage)
  const streaming = useMessageStore((s) => s.streaming.get(sessionId))

  useEffect(() => { textareaRef.current?.focus() }, [sessionId])

  const handleTextChange = async (value: string) => {
    setText(value)
    const atMatch = value.match(/@([^\s]*)$/)
    if (atMatch) {
      const q = atMatch[1]
      try {
        const c = getClient()
        const res = await c.find.files({ query: { query: q || "" } })
        const files = (res.data as string[]) || []
        setFileResults(files)
        setShowMentions(true)
      } catch { setFileResults([]) }
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (path: string) => {
    const newText = text.replace(/@([^\s]*)$/, `@${path} `)
    setText(newText)
    setShowMentions(false)
    textareaRef.current?.focus()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).map((f) => (f as File & { path?: string }).path || f.name)
    if (files.length) setText((t) => t + (t ? " " : "") + files.map((p) => `@${p}`).join(" "))
  }

  const handleSubmit = async () => {
    if (!text.trim() || streaming?.active) return
    const msg = text.trim()
    setText("")
    setShowMentions(false)
    if (textareaRef.current) textareaRef.current.style.height = "48px"
    await sendMessage(sessionId, msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit() }
    if (e.key === "Escape" && streaming?.active) abortMessage(sessionId)
    if (e.key === "Escape" && showMentions) setShowMentions(false)
  }

  return (
    <div className="border-t border-border bg-bg-secondary/70 backdrop-blur supports-[backdrop-filter]:bg-bg-secondary/55 p-3" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <div className="max-w-[760px] mx-auto relative">
        {showMentions && fileResults.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-border bg-bg-secondary shadow-soft overflow-hidden max-h-[180px] overflow-y-auto">
            <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-text-muted border-b border-border">@ mention file • {fileResults.length} results</div>
            {fileResults.map((f) => (
              <button key={f} onClick={() => insertMention(f)} className="w-full text-left px-3 py-2 text-[12px] font-mono text-text-secondary hover:bg-bg-tertiary hover:text-text-primary truncate">{f}</button>
            ))}
          </div>
        )}
        <div className="rounded-2xl border border-border bg-bg-tertiary shadow-soft overflow-hidden focus-within:border-accent/30 focus-within:ring-4 focus-within:ring-accent/10 transition-all">
          <div className="flex items-end gap-2 p-2.5">
            <button className="w-8 h-8 rounded-xl bg-bg-surface border border-border text-text-muted hover:text-text-primary flex items-center justify-center text-[13px]" title="Attach — drag & drop files">＋</button>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => { handleTextChange(e.target.value); const el = e.target as HTMLTextAreaElement; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 160) + "px" }}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything — @file to mention files • drag & drop to attach"
              rows={1}
              className="flex-1 bg-transparent text-[13px] leading-5 text-text-primary placeholder:text-text-muted resize-none focus:outline-none min-h-[28px] py-2"
              style={{ height: 48 }}
            />
            <div className="shrink-0 flex items-center gap-2">
              <span className="hidden sm:inline text-[11px] text-text-muted">{text.length > 0 ? `${text.length} chars` : "Shift+Enter newline"}</span>
              {streaming?.active ? (
                <button onClick={() => abortMessage(sessionId)} className="px-4 py-2 rounded-xl bg-error text-white text-[12px] font-semibold hover:bg-error/90 transition-colors">Stop</button>
              ) : (
                <button onClick={handleSubmit} disabled={!text.trim()} className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white flex items-center justify-center text-[14px] shadow-glow transition-all">➤</button>
              )}
            </div>
          </div>
          <div className="px-3 pb-2 flex items-center gap-2 text-[11px] text-text-muted">
            <ModelPicker />
            <span className="px-1.5 py-0.5 rounded-full bg-bg-surface border border-border">Enter to send</span>
            <span>•</span>
            <span>Esc to stop</span>
            <span className="ml-auto hidden sm:inline">Tip: <code className="px-1 py-0.5 rounded bg-bg-surface border border-border">@</code> to autocomplete files</span>
          </div>
        </div>
      </div>
    </div>
  )
}
