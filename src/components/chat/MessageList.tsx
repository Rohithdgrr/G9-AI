import { useEffect, useRef, useState } from "react"
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

function MarkdownBlock({ text, isUser }: { text: string; isUser: boolean }) {
  if (isUser) return <div className="whitespace-pre-wrap text-[13px] leading-6 text-white">{text}</div>
  return (
    <div className="prose prose-invert max-w-none prose-sm prose-p:leading-6 prose-p:my-2 prose-pre:my-2 prose-code:text-[12px] prose-code:font-mono prose-headings:font-semibold prose-a:text-accent">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{text}</ReactMarkdown>
    </div>
  )
}

function ToolRouter({ part }: { part: ToolPart }) {
  const tool = part.tool
  if (tool === "read") return <FilePreview part={part} />
  if (tool === "bash") return <BashOutput part={part} />
  if (tool === "edit" || tool === "write" || tool === "patch") return <DiffViewer part={part} />
  // grep, glob, webfetch, websearch, task, question, etc. -> generic but specialized in ToolCallCard
  return <ToolCallCard part={part} />
}

function MessageBubble({ message }: { message: MessageWithParts }) {
  const isUser = message.info.role === "user"
  const time = new Date(message.info.time.created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} message-enter`}>
      <div className={`max-w-[86%] rounded-2xl ${isUser ? "px-4 py-3 bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-glow" : "px-0 py-2 bg-transparent text-text-primary"} `}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold">G</div>
            <span className="text-[11px] font-semibold tracking-wide text-text-secondary">Ganesha</span>
            <span className="text-[11px] text-text-muted">• {time}</span>
          </div>
        )}
        <div className={`${isUser ? "" : "rounded-2xl border border-border bg-bg-secondary/80 backdrop-blur px-4 py-3.5 shadow-soft"}`}>
          {message.parts.map((part, i) => {
            if (part.type === "text") return <MarkdownBlock key={i} text={(part as TextPart).text} isUser={isUser} />
            if (part.type === "tool") return <ToolRouter key={i} part={part as ToolPart} />
            if (part.type === "reasoning") return <ReasoningBlock key={i} text={part.text} />
            if ((part as unknown as { text: string }).text) return <div key={i} className="text-[12px] text-text-secondary whitespace-pre-wrap my-1">{(part as unknown as { text: string }).text}</div>
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [rawMessages, streaming?.active])

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
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-accent-soft border border-accent/15 flex items-center justify-center text-accent text-xl">✦</div>
          <h2 className="text-[15px] font-semibold text-text-primary">Start a conversation</h2>
          <p className="text-[12px] leading-relaxed text-text-muted mt-1.5">Ask about your codebase, request edits, or run tasks. The agent can read, edit, grep, and run bash — all from chat.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left">
            {["Explain this repo structure", "Add auth to API routes", "Find where tokens are stored", "Run tests and fix failures"].map((s) => (
              <div key={s} className="rounded-xl border border-border bg-bg-secondary px-3 py-2.5 text-[12px] text-text-secondary">“{s}”</div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {loadingMore && <div className="text-center text-[11px] text-text-muted py-2">Loading more…</div>}
      {messages.map((m, i) => (
        <MessageBubble key={m.info.id || i} message={m} />
      ))}
      <PermissionPrompt sessionId={sessionId} />
      {streaming?.active && (
        <div className="flex justify-start">
          <div className="rounded-2xl border border-border bg-bg-secondary px-4 py-3 flex items-center gap-2.5">
            <span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <span className="text-[12px] text-text-muted">Thinking… streaming response</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
