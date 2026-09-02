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

  const canSend = text.trim().length > 0 && !streaming?.active

  return (
    <div className="border-t border-border bg-bg-panel p-3" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <div className="max-w-[740px] mx-auto">
        {/* Writing desk — elevated manuscript sheet with brass inlay */}
        <div className="rounded-[10px] border border-border bg-bg-secondary shadow-soft overflow-hidden focus-within:border-accent/30 focus-within:shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-all">
          {/* Desk header: model + hints */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-bg-tertiary/40">
            <ModelPicker />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-text-muted font-mono">
              <span className="w-1 h-1 rounded-full bg-accent" /> tab plan/build · ctrl+p commands
            </span>
            <span className="ml-auto hidden lg:inline text-[10px] text-text-muted font-mono">↵ send · ⇧↵ newline · esc stop</span>
          </div>

          <div className="relative">
            {showMentions && fileResults.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-border bg-bg-secondary shadow-soft overflow-hidden max-h-[180px] overflow-y-auto z-20">
                <div className="px-3 py-1.5 text-[10px] tracking-wide uppercase text-text-muted border-b border-border bg-bg-tertiary/50">↳ {fileResults.length} files</div>
                {fileResults.map((f) => (
                  <button key={f} onClick={() => insertMention(f)} className="w-full text-left px-3 py-2 text-[11px] font-mono text-text-secondary hover:bg-bg-surface hover:text-text-primary truncate border-b border-border/40 last:border-0">{f}</button>
                ))}
              </div>
            )}

            {/* Text area */}
            <div className="relative px-3 pt-3 pb-1">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => { handleTextChange(e.target.value); const el = e.target as HTMLTextAreaElement; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px" }}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything — type @ for files, drag & drop to attach"
                rows={1}
                className="w-full bg-transparent text-[13px] leading-6 text-text-primary placeholder:text-text-muted/60 resize-none focus:outline-none min-h-[44px] py-1 font-mono"
                style={{ height: 44 }}
              />
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border/50 bg-bg-tertiary/20">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-success/70" /> build · {text.length ? `${text.length} chars` : "ready"}
              </span>
              <span className="sm:hidden text-[10px] text-text-muted font-mono">build · ready</span>

              <div className="ml-auto flex items-center gap-2">
                {streaming?.active ? (
                  <button onClick={() => abortMessage(sessionId)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-error/30 bg-error-soft text-error text-[11px] font-semibold hover:bg-error/15">■ Stop</button>
                ) : (
                  <button onClick={handleSubmit} disabled={!canSend} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold transition-all ${canSend ? "bg-accent text-white hover:bg-accent-hover shadow-[0_2px_8px_rgba(200,169,106,0.3)]" : "bg-bg-surface border border-border text-text-muted cursor-not-allowed"}`}>
                    Send <span className="text-[11px]">↑</span>
                  </button>
                )}
              </div>
            </div>

            {/* Brass corner inlay — signature */}
            <span className="pointer-events-none absolute top-2 left-2 w-2 h-2 border-l border-t border-accent/30 rounded-tl" />
            <span className="pointer-events-none absolute top-2 right-2 w-2 h-2 border-r border-t border-accent/30 rounded-tr" />
            <span className="pointer-events-none absolute bottom-2 left-2 w-2 h-2 border-l border-b border-accent/30 rounded-bl" />
            <span className="pointer-events-none absolute bottom-2 right-2 w-2 h-2 border-r border-b border-accent/30 rounded-br" />
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-2 text-[10px] text-text-muted/60 font-mono">
          <span>Ganesha scribe</span><span>·</span><span>drop files anywhere</span>
        </div>
      </div>
    </div>
  )
}
