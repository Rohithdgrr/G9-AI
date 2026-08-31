export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

export function getFileIcon(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || ""
  const map: Record<string, string> = {
    ts: "TS", tsx: "TSX", js: "JS", jsx: "JSX", py: "PY", rs: "RS", go: "GO",
    md: "MD", json: "JSON", css: "CSS", html: "HTML", sh: "SH", yaml: "YML", toml: "TOML",
  }
  return map[ext] || "📄"
}

export function getLangFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || ""
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", rs: "rust", go: "go", md: "markdown", json: "json",
    css: "css", html: "html", sh: "bash", yaml: "yaml", toml: "toml",
  }
  return map[ext] || "plaintext"
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + "…" : str
}
