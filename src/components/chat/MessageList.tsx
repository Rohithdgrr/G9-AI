import { useEffect, useRef, useState, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { useMessageStore, type MessageWithParts } from "../../stores/message"
import type { ToolPart, TextPart } from "@opencode-ai/sdk/client"
import { FilePreview } from "../tools/FilePreview"
import { BashOutput } from "../tools/BashOutput"
import { DiffViewer } from "../tools/DiffViewer"
import { ReasoningBlock } from "../tools/ReasoningBlock"
import { ToolCallCard } from "../tools/ToolCallCard"
import { PermissionPrompt } from "../permissions/PermissionPrompt"

function normalizeMarkdownForStream(text: string, isStreaming: boolean): string {
  if (!isStreaming) return text
  // If a fenced code block is opened but not closed, append a closing fence so
  // react-markdown can render incrementally instead of showing nothing.
  const fenceCount = (text.match(/```/g) || []).length
  if (fenceCount % 2 === 1) return text + "\n```"
  return text
}

function MarkdownBlock({ text, isUser, isStreaming }: { text: string; isUser: boolean; isStreaming?: boolean }) {
  if (!text) return null
  if (isUser) return <div className="whitespace-pre-wrap text-[12px] leading-5 text-white font-mono">{text}</div>
  const normalized = normalizeMarkdownForStream(text, !!isStreaming)
  return (
    <div className="max-w-none font-mono text-[12px] leading-5 prose prose-sm prose-p:my-1.5 prose-pre:my-2 prose-code:text-[11px] prose-headings:font-semibold prose-headings:text-text-primary prose-a:text-accent prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{normalized}</ReactMarkdown>
    </div>
  )
}

function ToolRouter({ part }: { part: ToolPart }) {
  const tool = part.tool
  if (tool === "read") return <FilePreview part={part} />
  if (tool === "bash") return <BashOutput part={part} />
  if (tool === "edit" || tool === "write" || tool === "patch") return <DiffViewer part={part} />
  return <ToolCallCard part={part} />
}

function MessageBubble({ message, isStreaming }: { message: MessageWithParts; isStreaming?: boolean }) {
  const isUser = message.info.role === "user"
  const time = new Date(message.info.time.created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const isAssistantStreaming = !isUser && isStreaming
  // Don't render empty placeholder bubbles (created by upsertMessage with parts:[])
  const visibleParts = message.parts.filter((p) => {
    if (p.type === "text") return !!((p as TextPart).text || "").trim()
    if (p.type === "reasoning") return !!((p as { text: string }).text || "").trim()
    if (p.type === "tool") return true
    return !!(p as unknown as { text: string }).text
  })
  const hasVisibleContent = visibleParts.length > 0 || isUser
  // If assistant placeholder with no content yet, render nothing here — showThinking will cover it
  if (!isUser && !hasVisibleContent) return null

  const lastTextPart = [...message.parts].reverse().find((p) => p.type === "text") as TextPart | undefined
  const isStreamingText = !!isAssistantStreaming

  return (
    <div className="message-enter">
      {isUser ? (
        <div className="relative pl-4 py-2 my-3 bg-accent-soft/40 border border-accent/15 rounded">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-accent" />
          <div className="absolute -left-1 top-3 brass-dot" />
          <div className="text-[10px] tracking-widest uppercase text-text-muted font-mono mb-1">› You · {time}</div>
          <div className="text-[12px] leading-5 text-text-primary font-mono whitespace-pre-wrap">{message.parts.map((p,i)=> {
            if (p.type==="text") return <MarkdownBlock key={(p as {id:string}).id||i} text={(p as TextPart).text||""} isUser={true} />
            return null
          })}</div>
        </div>
      ) : (
        <div className="relative py-2 pl-4">
          <div className="absolute left-0 top-0 bottom-0 thread-line" />
          <div className="absolute -left-[3px] top-2 brass-dot opacity-60" />
          <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted mb-1">
            <span className="text-accent">▣</span><span className="tracking-widest uppercase">Ganesha</span><span>· {time}</span>
            {isAssistantStreaming && <span className="text-accent animate-pulse">● streaming</span>}
          </div>
          <div className="space-y-2">
            {message.parts.map((part, i) => {
              const isLastVisible = i === message.parts.length - 1
              if (part.type === "text") {
                const txt = (part as TextPart).text || ""
                if (!txt) return null
                return (
                  <span key={(part as { id: string }).id || i}>
                    <MarkdownBlock text={txt} isUser={false} isStreaming={isStreamingText && isLastVisible} />
                    {isStreamingText && isLastVisible && <span className="inline-block w-[2px] h-3 bg-accent ml-0.5 animate-pulse translate-y-[1px]" />}
                  </span>
                )
              }
              if (part.type === "tool") return <ToolRouter key={(part as { id: string }).id || i} part={part as ToolPart} />
              if (part.type === "reasoning") return <ReasoningBlock key={(part as { id: string }).id || i} text={(part as { text: string }).text} />
              if ((part as unknown as { text: string }).text) return <div key={(part as { id: string }).id || i} className="text-[11px] text-text-secondary whitespace-pre-wrap my-1 font-mono">{(part as unknown as { text: string }).text}</div>
              return null
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const EMPTY_MESSAGES: MessageWithParts[] = []

export function MessageList({ sessionId }: { sessionId: string }) {
  const rawMessages = useMessageStore((s) => s.messages.get(sessionId))
  const messages = rawMessages ?? EMPTY_MESSAGES
  const streaming = useMessageStore((s) => s.streaming.get(sessionId))
  const loadMessages = useMessageStore((s) => s.loadMessages)
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  // Auto-scroll: stick to bottom only if user is already near bottom
  const scrollToBottom = useCallback((smooth: boolean) => {
    const c = containerRef.current
    if (!c) return
    const atBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 160
    if (atBottom) {
      if (smooth) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      else c.scrollTop = c.scrollHeight
    }
  }, [])

  useEffect(() => {
    // Use instant scroll while streaming to avoid smooth-scroll queue jank
    const isStreaming = !!streaming?.active
    scrollToBottom(!isStreaming)
  }, [rawMessages, streaming?.active, scrollToBottom])

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollTop < 40 && !loadingMore && messages.length >= 20) {
      setLoadingMore(true)
      await loadMessages(sessionId, messages.length + 20)
      setLoadingMore(false)
    }
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-[440px] animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.16em] uppercase text-accent border border-accent/15 bg-accent-soft rounded-full px-2.5 py-1">◈ Palm leaves ready</div>
          <h2 className="font-display text-[22px] font-semibold text-text-primary mt-3">What shall we inscribe?</h2>
          <p className="text-[12px] leading-relaxed text-text-muted mt-1.5">Ask about your codebase, request edits, or run tasks. The thread holds every turn.</p>
          <div className="mt-5 grid grid-cols-2 gap-2 text-left">
            {["Explain this repo structure", "Add auth to API routes", "Find where tokens are stored", "Run tests and fix failures"].map((s) => (
              <div key={s} className="rounded border border-border bg-bg-surface hover:border-accent/20 px-2.5 py-2.5 text-[11px] text-text-secondary leading-snug">&ldquo;{s}&rdquo;</div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Show thinking indicator only while streaming AND no visible assistant content yet
  const hasVisibleAssistant = messages.some((m) => {
    if (m.info.role !== "assistant") return false
    return m.parts.some((p) => {
      if (p.type === "text") return !!((p as TextPart).text || "").trim()
      if (p.type === "tool") return true
      if (p.type === "reasoning") return !!((p as { text: string }).text || "").trim()
      return false
    })
  })
  const showThinking = streaming?.active && !hasVisibleAssistant

  return (
    <div ref={containerRef} data-testid="message-list" onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 font-mono">
      {loadingMore && <div className="text-center text-[10px] text-text-muted py-2">Loading more…</div>}
      {messages.map((m, i) => {
        const isLastAssistant = i === messages.length - 1 && m.info.role === "assistant"
        return <MessageBubble key={m.info.id || i} message={m} isStreaming={isLastAssistant && !!streaming?.active} />
      })}
      <PermissionPrompt sessionId={sessionId} />
      {showThinking && (
        <div className="flex items-center gap-2 text-[11px] text-text-muted py-1">
          <span className="w-2 h-2 border border-accent/30 border-t-accent rounded-full animate-spin" />
          <span>Thinking…</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
