import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/client"

let client: OpencodeClient | null = null
let actualServerUrl: string | null = null

export function connect(url: string, password?: string, directory?: string): OpencodeClient {
  const headers: Record<string, string> = {}
  if (password) {
    const encoded = btoa(`opencode:${password}`)
    headers["Authorization"] = `Basic ${encoded}`
  }
  const dir = directory || (() => { try { return localStorage.getItem("ganesha:directory") } catch { return null } })()
  if (dir) headers["x-opencode-directory"] = encodeURIComponent(dir)

  // In dev mode, use Vite proxy (same origin) to avoid CORS
  // In production, connect directly to the server
  const isDev = import.meta.env.DEV
  const baseUrl = isDev ? "" : url

  client = createOpencodeClient({ baseUrl, headers, ...(dir ? { directory: dir } : {}) })
  actualServerUrl = url
  return client
}

export function setDirectory(dir: string | null) {
  if (dir) { try { localStorage.setItem("ganesha:directory", dir) } catch {} }
  else { try { localStorage.removeItem("ganesha:directory") } catch {} }
  // Reconnect with new directory if already connected
  if (actualServerUrl) {
    connect(actualServerUrl)
  }
}

export function getClient(): OpencodeClient {
  if (!client) {
    throw new Error("Not connected to OpenCode server")
  }
  return client
}

export function getServerUrl(): string | null {
  return actualServerUrl
}

export function isConnected(): boolean {
  return client !== null
}

export function disconnect(): void {
  client = null
  actualServerUrl = null
}
