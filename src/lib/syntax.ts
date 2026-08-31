import { getLangFromPath } from "./utils"

// Simple syntax highlight placeholder — uses rehype-highlight via CSS
// For file previews we rely on <pre><code class="language-xxx">
export function highlightCode(code: string, lang?: string): string {
  return code
}

export function parseDiff(output: string): { type: "add" | "remove" | "context" | "hunk"; text: string }[] {
  const lines = output.split("\n")
  return lines.map((line) => {
    if (line.startsWith("@@")) return { type: "hunk", text: line }
    if (line.startsWith("+") && !line.startsWith("+++")) return { type: "add", text: line.slice(1) }
    if (line.startsWith("-") && !line.startsWith("---")) return { type: "remove", text: line.slice(1) }
    return { type: "context", text: line.startsWith(" ") ? line.slice(1) : line }
  })
}
