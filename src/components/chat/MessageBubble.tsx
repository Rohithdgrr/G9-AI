import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import type { MessageWithParts } from "../../stores/message"
import type { TextPart, ToolPart } from "@opencode-ai/sdk/client"
import { FilePreview } from "../tools/FilePreview"
import { BashOutput } from "../tools/BashOutput"
import { DiffViewer } from "../tools/DiffViewer"
import { ReasoningBlock } from "../tools/ReasoningBlock"
import { ToolCallCard } from "../tools/ToolCallCard"
function ToolRouter({ part }: { part: ToolPart }) { const t = part.tool; if (t === "read") return <FilePreview part={part} />; if (t === "bash") return <BashOutput part={part} />; if (t === "edit" || t === "write" || t === "patch") return <DiffViewer part={part} />; return <ToolCallCard part={part} /> }
export const MessageBubble = React.memo(function MessageBubble({ msg, isStreaming }: { msg: MessageWithParts; isStreaming?: boolean }) {
  const isUser = msg.info.role === "user"
  const time = new Date(msg.info.time.created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (isUser) { const text = (msg.parts.find((p) => p.type === "text") as TextPart | undefined)?.text || ""; return <div className="flex justify-end"><div className="max-w-[78%]"><div className="rounded-2xl rounded-br-md bg-accent text-white px-4 py-3 text-[13px] leading-6 whitespace-pre-wrap">{text}</div><div className="text-[10px] text-text-muted text-right mt-1">{time}</div></div></div> }
  return <div className="flex justify-start gap-2.5"><div className="w-7 h-7 rounded-full bg-bg-surface border border-border flex items-center justify-center text-[11px] font-bold shrink-0 mt-1">G</div><div className="max-w-[82%] rounded-2xl rounded-bl-md border border-border bg-bg-secondary px-4 py-3 space-y-2"><>{msg.parts.map((part, i) => { if (part.type === "text") { const txt = (part as TextPart).text || ""; if (!txt.trim()) return null; return <div key={(part as { id: string }).id || i} className="prose prose-sm max-w-none prose-p:my-1.5 prose-pre:my-2 prose-invert text-[13px] leading-6"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{txt}</ReactMarkdown>{isStreaming && i === msg.parts.length - 1 && <span className="inline-block w-1 h-4 bg-accent ml-1 animate-pulse align-middle" />}</div> } if (part.type === "tool") return <ToolRouter key={(part as { id: string }).id || i} part={part as ToolPart} />; if (part.type === "reasoning") return <ReasoningBlock key={(part as { id: string }).id || i} text={(part as { text: string }).text} />; return null })}</><div className="text-[10px] text-text-muted">{time}</div></div></div>
})
