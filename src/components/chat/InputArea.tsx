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
    <div className="border-t border-border bg-bg-secondary p-2.5 font-mono" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <div className="max-w-[760px] mx-auto flex flex-col gap-2">
        {/* Model bar — opencode: inline Build model */}
        <div className="flex items-center gap-2 flex-wrap text-[10px] text-text-muted">
          <ModelPicker />
          <span className="hidden sm:inline">· tab plan/build · ctrl+p commands</span>
          <span className="ml-auto hidden sm:inline">↵ send · shift+↵ newline · esc stop</span>
        </div>

        <div className="relative">
          {showMentions && fileResults.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 border border-border bg-bg-secondary overflow-hidden max-h-[180px] overflow-y-auto z-20 font-mono">
              <div className="px-2 py-1 text-[10px] text-text-muted border-b border-border">@ {fileResults.length} results</div>
              {fileResults.map((f) => (
                <button key={f} onClick={() => insertMention(f)} className="w-full text-left px-2 py-1.5 text-[11px] text-text-secondary hover:bg-bg-hover truncate">{f}</button>
              ))}
            </div>
          )}
          <div className="relative border border-border bg-bg-surface focus-within:border-accent/40 overflow-hidden" style={{ borderLeft: "2px solid var(--accent)" }}>
            <span className="absolute top-1.5 left-1.5 w-1 h-1 bg-accent/60 rounded-full" /><span className="absolute top-1.5 right-1.5 w-1 h-1 bg-accent/60 rounded-full" /><span className="absolute bottom-1.5 left-1.5 w-1 h-1 bg-accent/60 rounded-full" /><span className="absolute bottom-1.5 right-1.5 w-1 h-1 bg-accent/60 rounded-full" />
            <div className="flex items-end gap-2 p-2">
              <span className="text-accent text-[12px] pl-1">┃</span>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => { handleTextChange(e.target.value); const el = e.target as HTMLTextAreaElement; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 160) + "px" }}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything — @ for files"
                rows={1}
                className="flex-1 bg-transparent text-[12px] leading-5 text-text-primary placeholder:text-text-muted resize-none focus:outline-none min-h-[24px] py-1 font-mono"
                style={{ height: 40 }}
              />
              <div className="shrink-0 flex items-center gap-2">
                {streaming?.active ? (
                  <button onClick={() => abortMessage(sessionId)} className="px-3 py-1.5 rounded border border-error text-error hover:bg-error-soft text-[11px] font-medium">■ stop</button>
                ) : (
                  <button onClick={handleSubmit} disabled={!text.trim()} className="px-3 py-1.5 rounded bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-[11px] font-semibold">↑</button>
                )}
              </div>
            </div>
            <div className="h-px bg-border mx-2" />
            <div className="px-2 py-1 text-[10px] text-text-muted">╹ build · {text.length ? `${text.length} chars` : "ready"}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
