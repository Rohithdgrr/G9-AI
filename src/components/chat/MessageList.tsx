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
  if (isUser) return <div className="whitespace-pre-wrap text-[13px] leading-6 text-white">{text}</div>
  const normalized = normalizeMarkdownForStream(text, !!isStreaming)
  return (
    <div className="prose prose-invert max-w-none prose-sm prose-p:leading-6 prose-p:my-2 prose-pre:my-2 prose-code:text-[12px] prose-code:font-mono prose-headings:font-semibold prose-a:text-accent">
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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} message-enter`}>
      <div className={`max-w-[86%] rounded-2xl ${isUser ? "px-4 py-3 bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-glow" : "px-0 py-2 bg-transparent text-text-primary"} `}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold">G</div>
            <span className="text-[11px] font-semibold tracking-wide text-text-secondary">Ganesha</span>
            <span className="text-[11px] text-text-muted">&bull; {time}</span>
            {isAssistantStreaming && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-soft border border-accent/20 text-accent animate-pulse">streaming</span>}
          </div>
        )}
        <div className={`${isUser ? "" : "rounded-2xl border border-border bg-bg-secondary/80 backdrop-blur px-4 py-3.5 shadow-soft"}`}>
          {message.parts.map((part, i) => {
            const isLastVisible = i === message.parts.length - 1
            if (part.type === "text") {
              const txt = (part as TextPart).text || ""
              if (!txt) return null
              return (
                <span key={(part as { id: string }).id || i}>
                  <MarkdownBlock text={txt} isUser={isUser} isStreaming={isStreamingText && isLastVisible} />
                  {isStreamingText && isLastVisible && (
                    <span className="inline-block w-[3px] h-[1.1em] bg-accent ml-0.5 animate-pulse translate-y-[2px] rounded-full" />
                  )}
                </span>
              )
            }
            if (part.type === "tool") return <ToolRouter key={(part as { id: string }).id || i} part={part as ToolPart} />
            if (part.type === "reasoning") return <ReasoningBlock key={(part as { id: string }).id || i} text={(part as { text: string }).text} />
            if ((part as unknown as { text: string }).text) return <div key={(part as { id: string }).id || i} className="text-[12px] text-text-secondary whitespace-pre-wrap my-1">{(part as unknown as { text: string }).text}</div>
            return null
          })}
          {isUser && <div className="text-[11px] text-white/70 mt-1.5 text-right">{time}</div>}
        </div>
      </div>
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
        <div className="text-center max-w-[420px] animate-fadeIn">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-accent-soft border border-accent/15 flex items-center justify-center text-accent text-xl">&#10022;</div>
          <h2 className="text-[15px] font-semibold text-text-primary">Start a conversation</h2>
          <p className="text-[12px] leading-relaxed text-text-muted mt-1.5">Ask about your codebase, request edits, or run tasks. The agent can read, edit, grep, and run bash &mdash; all from chat.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left">
            {["Explain this repo structure", "Add auth to API routes", "Find where tokens are stored", "Run tests and fix failures"].map((s) => (
              <div key={s} className="rounded-xl border border-border bg-bg-secondary px-3 py-2.5 text-[12px] text-text-secondary">&ldquo;{s}&rdquo;</div>
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
    <div ref={containerRef} data-testid="message-list" onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {loadingMore && <div className="text-center text-[11px] text-text-muted py-2">Loading more...</div>}
      {messages.map((m, i) => {
        const isLastAssistant = i === messages.length - 1 && m.info.role === "assistant"
        return <MessageBubble key={m.info.id || i} message={m} isStreaming={isLastAssistant && !!streaming?.active} />
      })}
      <PermissionPrompt sessionId={sessionId} />
      {showThinking && (
        <div className="flex justify-start message-enter">
          <div className="rounded-2xl border border-border bg-bg-secondary px-4 py-3 flex items-center gap-2.5">
            <span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <span className="text-[12px] text-text-muted">Thinking...</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
