import { create } from "zustand"
import { getClient } from "../sdk/client"

interface ProjectInfo {
  worktree: string
  directory: string
}

interface VcsInfo {
  branch?: string
  status?: string
}

interface ProjectState {
  current: ProjectInfo | null
  vcs: VcsInfo | null
  loading: boolean
  openFolder: () => Promise<void>
  loadProject: () => Promise<void>
  setDirectory: (dir: string) => void
  getDirectory: () => string | null
}

function getStoredDir(): string | null {
  try { return localStorage.getItem("ganesha:directory") } catch { return null }
}

export const useProjectStore = create<ProjectState>(() => ({
  current: null,
  vcs: null,
  loading: false,

  loadProject: async () => {
    // Implemented via direct call, not create state
  },

  // placeholder - real impl is below with set
  openFolder: async () => {},
  setDirectory: () => {},
  getDirectory: () => getStoredDir(),
}))

// Patch methods that need set
useProjectStore.setState({
  loadProject: async () => {
    useProjectStore.setState({ loading: true } as Partial<ProjectState>)
    try {
      const c = getClient()
      const [pathRes, vcsRes] = await Promise.allSettled([
        c.path.get(),
        c.vcs.get(),
      ])
      let current: ProjectInfo | null = null
      let vcs: VcsInfo | null = null
      if (pathRes.status === "fulfilled") {
        const d = pathRes.value.data as { worktree?: string; directory?: string; worktreeID?: string }
        if (d) current = { worktree: d.worktree || "", directory: (d as { directory?: string }).directory || d.worktree || "" }
      }
      if (vcsRes.status === "fulfilled") {
        const v = vcsRes.value.data as { branch?: string }
        if (v) vcs = v as VcsInfo
      }
      useProjectStore.setState({ current, vcs, loading: false } as Partial<ProjectState>)
    } catch {
      useProjectStore.setState({ loading: false } as Partial<ProjectState>)
    }
  },

  setDirectory: (dir: string) => {
    try { localStorage.setItem("ganesha:directory", dir) } catch {}
    // Update SDK client header for next requests
    // We store directory; client.ts reads it via x-opencode-directory header
    // Trigger reload
    useProjectStore.getState().loadProject()
  },

  openFolder: async () => {
    try {
      const tauri = await import("@tauri-apps/plugin-dialog").then(m => m)
      const selected = await tauri.open({ directory: true, multiple: false, title: "Open Project Folder" })
      if (typeof selected === "string" && selected) {
        localStorage.setItem("ganesha:directory", selected)
        // Recreate client with new directory header
        const { connect, getServerUrl } = await import("../sdk/client")
        const url = getServerUrl() || "http://localhost:4096"
        connect(url)
        // Also set via SDK header for next calls
        const { getClient } = await import("../sdk/client")
        try {
          // Force directory via header injection: set on next fetch via x-opencode-directory
          // The SDK's createOpencodeClient supports directory option; we emulate by setting header
          // For now, also store in localStorage and reload page to reinitialize
          location.reload()
        } catch {}
      }
    } catch {
      // Fallback: prompt
      const dir = prompt("Enter project directory path:")
      if (dir) {
        localStorage.setItem("ganesha:directory", dir)
        location.reload()
      }
    }
  },

  getDirectory: () => getStoredDir(),
})
