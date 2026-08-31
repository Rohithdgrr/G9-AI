import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/client"

let client: OpencodeClient | null = null
let actualServerUrl: string | null = null

export function connect(url: string, password?: string): OpencodeClient {
  const headers: Record<string, string> = {}
  if (password) {
    const encoded = btoa(`opencode:${password}`)
    headers["Authorization"] = `Basic ${encoded}`
  }

  // In dev mode, use Vite proxy (same origin) to avoid CORS
  // In production, connect directly to the server
  const isDev = import.meta.env.DEV
  const baseUrl = isDev ? "" : url

  client = createOpencodeClient({ baseUrl, headers })
  actualServerUrl = url
  return client
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
