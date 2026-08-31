# Ganesha — OpenCode Single-Agent Chat Desktop IDE

> A minimalist, single-agent chat desktop application built with Tauri, React, and powered by OpenCode's core backend.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Aim / Vision](#aim--vision)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Design](#design)
- [Backend Integration](#backend-integration)
- [UI/UX](#uiux)
- [API Reference](#api-reference)
- [Workflow](#workflow)
- [Features List](#features-list)
- [Novel Features](#novel-features)
- [Working of the Project](#working-of-the-project)
- [Setup & Development](#setup--development)
- [Phased Development Plan](#phased-development-plan)
- [Problematic Areas](#problematic-areas)
- [Risk Factors](#risk-factors)
- [Advantages](#advantages)
- [Performance](#performance)
- [Security](#security)
- [Maintenance](#maintenance)
- [Future Scope](#future-scope)
- [License](#license)

---

## Problem Statement

Existing AI coding agents (OpenCode TUI, Cursor, Claude Code) are powerful but suffer from **interface complexity** — they combine file explorers, editors, terminals, and multi-agent tabs into a single overwhelming surface. Users who simply want to **chat with an AI that can read, edit, and run code** are forced to navigate unnecessary UI chrome. There is no lightweight, focused desktop experience that leverages OpenCode's robust backend while stripping away everything except the conversation.

Key pain points:

- **Cognitive overload** from multi-panel IDE layouts
- **Context switching** between chat, terminal, and file tree
- **No standalone desktop app** that uses OpenCode's 182K+ star backend without the TUI
- **Heavy Electron-based alternatives** with 200MB+ bundles and poor performance

---

## Aim / Vision

Build a **minimalist, single-agent chat desktop application** using **Tauri v2** as the frontend framework, powered entirely by **OpenCode's core backend** (agent runtime, sessions, model providers, tools, file operations, LSP, MCP, permissions, etc.). The app presents **only a chat interface** — no file explorer, no code editor, no terminal panel — yet the agent retains full capability to read, write, edit, grep, run bash, use LSP diagnostics, and invoke MCP tools. The user interacts purely through natural language; the agent does the work.

Core principles:

- **Chat-first, always** — every interaction is a message
- **Zero chrome** — no menus, no toolbars, no file tree
- **Progressive disclosure** — tool outputs appear as collapsible cards inside chat
- **Native performance** — Tauri uses OS WebView, ~5MB bundle vs 200MB+ Electron
- **Secure by default** — Rust backend, OS keyring, permission gates on every dangerous tool

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Framework** | Tauri v2 | Cross-platform desktop shell (Rust + WebView) |
| **Frontend UI** | React 19 + TypeScript | Component-based chat interface |
| **Styling** | Tailwind CSS v4 | Utility-first responsive design |
| **State Management** | Zustand | Lightweight global state for sessions/messages |
| **Streaming** | SSE via `@opencode-ai/sdk` | Real-time message/tool event streams |
| **Backend (External)** | OpenCode Server (`opencode serve`) | Headless HTTP API exposing all core modules |
| **SDK** | `@opencode-ai/sdk` | Type-safe client for OpenCode v2 API (auto-generated from OpenAPI) |
| **Authentication** | HTTP Basic Auth + OS Keyring | Secure API access via Rust keyring |
| **Build Tool** | Vite | Fast dev server and bundling |
| **Package Manager** | pnpm | Workspace management |
| **Markdown** | react-markdown + remark-gfm + rehype-highlight | Render assistant responses |
| **Diff Rendering** | diff | Inline file change visualization |
| **Virtualization** | react-window | Efficient long message list rendering |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri Desktop App                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React Frontend (Chat UI)                             │  │
│  │  • Message List • Input Box • Tool Cards • Settings   │  │
│  │  • Permission Prompts • Session Sidebar               │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↕ IPC / HTTP                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Rust Tauri Commands (Lightweight Bridge)             │  │
│  │  • Secure credential storage (keyring)                │  │
│  │  • Native OS integrations (notifications, tray)       │  │
│  │  • File drag-drop handling                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕ HTTP / SSE
┌─────────────────────────────────────────────────────────────┐
│              OpenCode Server (External Process)               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Sessions│ │  Tools  │ │  LSP    │ │   MCP   │           │
│  │ Runtime │ │(read/edit│ │Servers  │ │Servers  │           │
│  │         │ │/bash/grep│ │         │ │         │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  Model  │ │  Auth   │ │  Git    │ │Permission│           │
│  │Providers│ │         │ │  VCS    │ │  System  │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│  │Subagents│ │Context  │ │  SDK    │                       │
│  │         │ │Management│ │  API    │                       │
│  └─────────┘ └─────────┘ └─────────┘                       │
└─────────────────────────────────────────────────────────────┘
                              ↕
                    Local Filesystem / Git Repo
```

### Project Structure

```
ganesha/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── src/
│   │   ├── lib.rs
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs
│   │   │   ├── tray.rs
│   │   │   └── dragdrop.rs
│   │   └── state.rs
│   └── icons/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── sdk/
│   │   ├── client.ts
│   │   ├── events.ts
│   │   └── types.ts
│   ├── stores/
│   │   ├── session.ts
│   │   ├── message.ts
│   │   ├── connection.ts
│   │   ├── permission.ts
│   │   └── settings.ts
│   ├── hooks/
│   │   ├── useEventStream.ts
│   │   ├── usePermission.ts
│   │   └── useInfiniteScroll.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── TitleBar.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── chat/
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── InputArea.tsx
│   │   │   ├── StreamingIndicator.tsx
│   │   │   └── WelcomeScreen.tsx
│   │   ├── tools/
│   │   │   ├── ToolCallCard.tsx
│   │   │   ├── DiffViewer.tsx
│   │   │   ├── BashOutput.tsx
│   │   │   ├── FilePreview.tsx
│   │   │   └── ReasoningBlock.tsx
│   │   ├── permissions/
│   │   │   └── PermissionPrompt.tsx
│   │   ├── sessions/
│   │   │   ├── SessionList.tsx
│   │   │   └── SessionItem.tsx
│   │   ├── settings/
│   │   │   ├── SettingsPanel.tsx
│   │   │   ├── ServerSettings.tsx
│   │   │   ├── ModelSelector.tsx
│   │   │   └── ThemeToggle.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Dropdown.tsx
│   │       └── Toast.tsx
│   ├── lib/
│   │   ├── markdown.ts
│   │   ├── syntax.ts
│   │   └── utils.ts
│   └── styles/
│       ├── globals.css
│       └── themes.css
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── postcss.config.js
```

### Data Flow

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User      │────→│  React Chat UI  │────→│ Tauri Commands  │
│  (types)    │     │  (Zustand state)│     │ (Rust bridge)   │
└─────────────┘     └─────────────────┘     └─────────────────┘
                                                    │
                          ┌─────────────────────────┘
                          ↓
                   ┌─────────────┐
                   │  HTTP POST  │  /session/:id/prompt_async
                   │  (SDK)      │
                   └─────────────┘
                          │
                          ↓
                   ┌─────────────┐
                   │ OpenCode    │
                   │ Server      │ → LLM API call
                   │ (Bun/Node)  │ → Tool execution loop
                   └─────────────┘
                          │
                    ┌─────┴─────┐
                    ↓           ↓
              SSE Events    File Changes
                    │           │
                    ↓           ↓
              ┌─────────┐  ┌──────────┐
              │ Frontend│  │ Local FS │
              │ renders │  │ / Git    │
              │ updates │  │          │
              └─────────┘  └──────────┘
```

---

## Design

### Design Philosophy

- **Chat-first, always.** Every interaction is a message.
- **Zero chrome.** No menus, no toolbars, no file tree.
- **Progressive disclosure.** Tool outputs, diffs, and file reads appear as collapsible cards *inside* the chat.
- **Dark mode default.** Developer-focused aesthetic.

### Screen Layout

```
┌────────────────────────────────────────────────────────────┐
│  [≡]  ChatAgent    [🔍 Search...]    [⚙️] [👤]            │  ← Title Bar (minimal)
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  🤖 Hello! I'm ready to help with your code.       │   │
│  │     What would you like to work on?                │   │
│  │                                            10:23   │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Add auth to the API routes                        │   │
│  │                                            10:24   │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  🤖 I'll add authentication to your API routes.    │   │
│  │     Let me first explore the project structure.    │   │
│  │                                                    │   │
│  │  [🔧 Tool: glob] Searching for route files...      │   │
│  │  [🔧 Tool: read] src/routes/index.ts               │   │
│  │     ┌─────────────────────────────────────────┐    │   │
│  │     │ 1 │ import { Router } from 'express';   │    │   │
│  │     │ 2 │ ...                                │    │   │
│  │     └─────────────────────────────────────────┘    │   │
│  │  [🔧 Tool: edit] src/routes/index.ts               │   │
│  │     ┌─────────────────────────────────────────┐    │   │
│  │     │ - const router = Router();              │    │   │
│  │     │ + const router = Router();              │    │   │
│  │     │ + import { authMiddleware } from...     │    │   │
│  │     └─────────────────────────────────────────┘    │   │
│  │                                                    │   │
│  │  ✅ Done! I've added auth middleware to all        │   │
│  │     protected routes. Here's a summary:            │   │
│  │     • Modified: src/routes/index.ts                │   │
│  │     • Modified: src/routes/users.ts                │   │
│  │     • Added: src/middleware/auth.ts                │   │
│  │                                            10:25   │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  ⚠️ Permission Required                            │   │
│  │  The agent wants to run: npm test                  │   │
│  │  [Allow Once]  [Allow Always]  [Deny]              │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  [📎] [🎙️]  Type your message...              [➤ Send]   │  ← Input Area
│                                                            │
│  Model: Claude Sonnet 5  │  Agent: build  │  📁 my-app   │  ← Status Bar
└────────────────────────────────────────────────────────────┘
```

### Message Types Rendered

| Type | Visual Treatment |
|------|-----------------|
| **User Text** | Right-aligned bubble, accent color |
| **Assistant Text** | Left-aligned, full width, markdown rendered |
| **Reasoning/Thinking** | Collapsible gray block with "Thinking..." label |
| **Tool Call (read/grep/glob)** | Collapsible card with file icon, path, preview |
| **Tool Call (edit/write)** | Diff view with syntax highlighting, green/red |
| **Tool Call (bash)** | Terminal-style block with command and output |
| **Tool Call (MCP)** | Badge with server name, collapsible result |
| **Permission Request** | Inline alert card with Allow/Deny buttons |
| **Agent Switch** | Subtle system message "Switched to plan agent" |
| **Compaction** | Faded system message "Context compacted" |
| **Error** | Red alert banner with retry option |

### Color Palette (Dark Theme)

```css
:root {
  --bg-primary: #0a0a0b;
  --bg-secondary: #111113;
  --bg-tertiary: #1a1a1d;
  --bg-surface: #222225;
  --text-primary: #e4e4e7;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --accent: #6366f1;
  --accent-hover: #818cf8;
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --border: #27272a;
  --diff-add-bg: #052e16;
  --diff-add-text: #86efac;
  --diff-remove-bg: #450a0a;
  --diff-remove-text: #fca5a5;
}
```

### Session Sidebar (Collapsible)

- List of past sessions with titles + last message preview
- New Session button
- Search sessions
- Delete / rename / fork

### Settings Panel

- **Server**: URL, auth credentials, connection test
- **Model**: Dropdown of available models from `/config/providers`
- **Agent**: Fixed to "build" (single agent), but show info
- **Project**: Working directory selector
- **Permissions**: Default permission levels (allow/ask/deny per tool)
- **Appearance**: Theme, font size, message density

---

## Backend Integration

Your app does **NOT** reimplement any backend logic. It consumes OpenCode's v2 HTTP API entirely via `@opencode-ai/sdk`.

### Core Modules Utilized

| Module | SDK Methods | Role in App |
|--------|------------|-------------|
| **Agent Runtime** | `client.session.prompt()`, `client.session.prompt_async()` | Drives the single agent loop |
| **Sessions** | `client.session.list()`, `.create()`, `.delete()`, `.get()`, `.update()`, `.fork()` | CRUD for chat sessions |
| **Messages** | `client.session.messages()`, `client.session.message()` | Message history |
| **Model Providers** | `client.config.providers()`, `client.provider.list()` | Model selection & switching |
| **Authentication** | `client.auth.set()`, `client.provider.list()` | Provider OAuth/key auth |
| **Tools** | Built-in via agent runtime (`read`, `edit`, `write`, `bash`, `grep`, `glob`) | Agent file/code operations |
| **Files** | `client.file.read()`, `client.find.files()`, `client.find.text()` | Display file references in chat |
| **Git / VCS** | `client.path.get()` | Show repo status |
| **LSP** | Server status via health check | Background diagnostics (invisible to user) |
| **MCP** | Server management via HTTP | External tool integrations |
| **Permissions** | `client.postSessionByIdPermissionsByPermissionId()` | User approval UI for dangerous ops |
| **Context** | `client.session.summarize()` | Session compaction |
| **Subagents** | Automatic via agent runtime | Agent can spawn subagents |
| **Events** | `client.event.subscribe()` | Real-time SSE event stream |

### SDK Client Connection

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk"

export function connect(url: string, password?: string) {
  const headers: Record<string, string> = {}
  if (password) {
    headers["Authorization"] = `Basic ${btoa(`opencode:${password}`)}`
  }
  return createOpencodeClient({ baseUrl: url, headers })
}
```

### Authentication Flow

```
1. App starts → Checks for saved server URL + credentials (Rust keyring)
2. No credentials → Show "Connect to OpenCode Server" screen
3. User enters server URL + password (or auto-detects local `opencode serve`)
4. App validates → client.global.health()
5. Provider setup → client.provider.list() → Show OAuth/key flows
6. Tokens stored securely in OS keyring via Tauri Rust commands
```

---

## UI/UX

### Component Hierarchy

```
App
├── ConnectionScreen (if not connected)
├── AppShell
│   ├── TitleBar
│   │   ├── Sidebar Toggle (≡)
│   │   ├── App Title
│   │   ├── Search
│   │   ├── Settings Button
│   │   └── User Menu
│   ├── Sidebar (collapsible)
│   │   ├── New Session Button
│   │   ├── Session Search
│   │   └── SessionList
│   │       └── SessionItem[] (title, preview, timestamp)
│   ├── ChatArea
│   │   ├── MessageList (virtualized)
│   │   │   ├── WelcomeScreen (empty state)
│   │   │   └── MessageBubble[]
│   │   │       ├── User Text
│   │   │       ├── Assistant Text (markdown)
│   │   │       ├── ReasoningBlock (collapsible)
│   │   │       ├── ToolCallCard[]
│   │   │       │   ├── FilePreview
│   │   │       │   ├── DiffViewer
│   │   │       │   ├── BashOutput
│   │   │       │   └── ReasoningBlock
│   │   │       └── PermissionPrompt
│   │   ├── StreamingIndicator (during response)
│   │   └── InputArea
│   │       ├── File Attach
│   │       ├── Voice Input
│   │       ├── Textarea
│   │       └── Send Button
│   └── StatusBar
│       ├── Current Model
│       ├── Active Agent
│       └── Project Directory
├── SettingsPanel (modal/drawer)
│   ├── ServerSettings
│   ├── ModelSelector
│   └── ThemeToggle
└── Toast Notifications
```

### Interaction Patterns

| Action | UX |
|--------|-----|
| Send message | Enter key, or click Send button |
| New line in input | Shift+Enter |
| Cancel streaming | Escape key, or Cancel button |
| New session | Ctrl+N, or sidebar button |
| Search sessions | Ctrl+K, or sidebar search |
| Open settings | Ctrl+,, or gear icon |
| Collapse tool card | Click card header |
| Revert changes | Click Revert on diff card |
| Approve permission | Click Allow Once / Allow Always |
| Attach file | Drag-drop or `@path` mention |
| Switch model | Settings panel → Model dropdown |

### Responsive Behavior

- **Wide screen (>1200px)**: Sidebar visible by default
- **Medium screen (800-1200px)**: Sidebar collapsed, toggle to show
- **Narrow screen (<800px)**: Sidebar overlay, full-width chat

---

## API Reference

### Key SDK Methods Used

| Feature | SDK Method | HTTP Equivalent |
|---------|-----------|-----------------|
| Health Check | `client.global.health()` | `GET /global/health` |
| List Sessions | `client.session.list()` | `GET /session` |
| Create Session | `client.session.create({ body: { title } })` | `POST /session` |
| Get Session | `client.session.get({ path: { id } })` | `GET /session/:id` |
| Delete Session | `client.session.delete({ path: { id } })` | `DELETE /session/:id` |
| Update Session | `client.session.update({ path: { id }, body: { title } })` | `PATCH /session/:id` |
| Send Message | `client.session.prompt({ path: { id }, body: { parts } })` | `POST /session/:id/message` |
| Send Async | `client.session.prompt_async({ path: { id }, body: { parts } })` | `POST /session/:id/prompt_async` |
| Get Messages | `client.session.messages({ path: { id } })` | `GET /session/:id/message` |
| Get Message | `client.session.message({ path: { id, messageID } })` | `GET /session/:id/message/:msgId` |
| List Agents | `client.app.agents()` | `GET /agent` |
| List Models | `client.config.providers()` | `GET /config/providers` |
| Switch Model | Include `model` in prompt body | `POST /session/:id/message` with model |
| List Providers | `client.provider.list()` | `GET /provider` |
| Provider Auth | `client.provider.auth()` | `GET /provider/auth` |
| Fork Session | `client.session.fork({ path: { id }, body: { messageID } })` | `POST /session/:id/fork` |
| Abort Session | `client.session.abort({ path: { id } })` | `POST /session/:id/abort` |
| Share Session | `client.session.share({ path: { id } })` | `POST /session/:id/share` |
| Summarize | `client.session.summarize({ path: { id }, body: { providerID, modelID } })` | `POST /session/:id/summarize` |
| Revert | `client.session.revert({ path: { id }, body: { messageID } })` | `POST /session/:id/revert` |
| Permission Reply | `client.postSessionByIdPermissionsByPermissionId(...)` | `POST /session/:id/permissions/:permId` |
| Search Files | `client.find.files({ query: { query } })` | `GET /find/file?query=` |
| Search Text | `client.find.text({ query: { pattern } })` | `GET /find?pattern=` |
| Read File | `client.file.read({ query: { path } })` | `GET /file/content?path=` |
| VCS Status | `client.path.get()` | `GET /path` |
| MCP Status | via HTTP | `GET /mcp` |
| Add MCP | via HTTP | `POST /mcp` |
| LSP Status | via HTTP | `GET /lsp` |
| Global Events | `client.event.subscribe()` | `GET /event` (SSE) |

### SSE Event Types

| Event | Description | Handler |
|-------|-------------|---------|
| `server.connected` | Server connection established | Update connection state |
| `session.status` | Session state changed (idle/running/error) | Update status indicator |
| `message.part.updated` | New text chunk or tool part streaming | Append to message store |
| `message.part.removed` | Part deleted (e.g., during revert) | Remove from message store |
| `tool.execute.before` | Tool starting execution | Show tool card with spinner |
| `tool.execute.after` | Tool completed execution | Update tool card with result |
| `permission.asked` | Permission required for tool | Show permission prompt |
| `file.edited` | File was modified by agent | Update file references |

---

## Workflow

### User Journey: First Launch

```
1. Splash Screen → "Connect to OpenCode Server"
2. Auto-detect local `opencode serve` on port 4096, or manual URL entry
3. Auth → Enter server password (Basic Auth) or skip if local
4. Provider Setup → OAuth flow for Anthropic/OpenAI/etc via provider API
5. Project Selection → Pick working directory
6. First Session → Auto-created with default model, empty chat ready
```

### User Journey: Daily Use

```
1. App opens → Restores last session or shows session list
2. User types prompt → e.g., "fix the bug in auth"
3. Message sent → client.session.prompt_async()
4. Agent thinks → Reasoning block appears (collapsible)
5. Agent reads files → Tool cards appear with file previews
6. Agent edits code → Diff cards appear inline
7. Permission needed → Inline prompt for bash/edit approval
8. User approves → Agent continues
9. Response complete → Final summary message, session auto-saved
```

### User Journey: Permission Handling

```
Agent calls bash "npm test" with permission=ask
  ↓
SSE event: permission.asked
  ↓
Frontend renders inline permission card
  ↓
User clicks "Allow Once"
  ↓
POST /session/:id/permissions/:permissionID with response: "once"
  ↓
SSE event: tool.execute.after with results
  ↓
Frontend renders test output
```

### Message Lifecycle

```
User Input
  ↓
Validate not empty
  ↓
POST /session/:id/prompt_async { parts: [{ type: "text", text }] }
  ↓
SSE: message.part.updated (user message echo)
  ↓
SSE: session.status → "running"
  ↓
SSE: message.part.updated (assistant text chunks)
  ↓
SSE: message.part.updated (tool invocation - before)
  ↓
  ├── Tool: read → Show file preview card
  ├── Tool: edit → Show diff viewer card
  ├── Tool: bash → Show terminal output card
  ├── Tool: grep → Show matches card
  └── Tool: glob → Show file list card
  ↓
SSE: message.part.updated (tool invocation - after)
  ↓
  ├── Permission needed? → Show prompt, wait for reply
  └── Permission auto-allowed → Continue
  ↓
SSE: message.part.updated (more text chunks)
  ↓
SSE: session.status → "idle"
  ↓
Render final message
```

---

## Features List

### Core Features

- [x] Single-agent chat interface (no multi-agent tabs)
- [x] Real-time streaming responses via SSE
- [x] Markdown rendering with code syntax highlighting
- [x] Inline tool call cards (read, edit, write, bash, grep, glob)
- [x] Inline diff viewer for file edits
- [x] Permission request prompts with allow/deny/always
- [x] Session management (create, list, delete, fork, rename, search)
- [x] Message history with infinite scroll pagination
- [x] Model switching mid-session
- [x] File attachment via drag-drop or `@path` mention
- [x] Session compaction / revert to previous message
- [x] Dark/light theme toggle

### Advanced Features

- [x] MCP server management (add/remove/connect via UI)
- [x] Git diff display for session changes
- [x] VCS status indicator in status bar
- [x] Shell command output streaming
- [x] Agent reasoning/thinking block display
- [x] Auto-generated session titles from first prompt
- [x] Keyboard shortcuts (Ctrl+N new session, Ctrl+K search, Escape cancel)
- [x] System tray integration (minimize to tray, notifications)
- [x] Native OS notifications for long-running tasks

---

## Novel Features

| Feature | Description |
|---------|-------------|
| **Chat-Native Diffs** | File edits don't open an editor — they appear as inline diff cards with syntax highlighting, keeping the user in flow |
| **Invisible LSP** | LSP runs in background (no UI), but agent uses diagnostics to self-correct edits — user just sees better code |
| **Permission Memory** | App remembers user's allow/always/deny choices per project and pre-configures OpenCode's permission system |
| **Context-Aware Suggestions** | Input box suggests `@file` references based on recent agent reads and project structure |
| **Session Timeline** | Visual timeline of all file changes in a session, clickable to revert to any point |
| **Agent Monologue Mode** | Toggle to see/hide the agent's internal reasoning and tool planning steps |
| **Smart Compaction Alerts** | Warns when session approaches context limit, offers one-click compaction |
| **Native Desktop Feel** | ~5MB bundle via Tauri vs 200MB+ Electron apps, instant startup, system tray |

---

## Working of the Project

### Component Interaction

```
┌──────────────────────────────────────────────────────────┐
│                     GANESHA DESKTOP APP                    │
│                                                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   React UI   │←──→│   Zustand    │←──→│  OpenCode    │ │
│  │  Components  │    │   Stores     │    │  SDK Client  │ │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘ │
│         │                   │                   │          │
│         │    ┌──────────────┴──────────────┐    │          │
│         │    │         IPC Layer            │    │          │
│         │    │  React ←→ Rust Commands      │    │          │
│         │    └──────────────┬──────────────┘    │          │
│         │                   │                   │          │
│  ┌──────┴───────┐    ┌─────┴────────┐   ┌─────┴────────┐ │
│  │  Markdown    │    │   Rust Tauri  │   │  HTTP / SSE  │ │
│  │  Renderer    │    │   Backend    │   │  Connection  │ │
│  └──────────────┘    └──────────────┘   └──────┬───────┘ │
│                                                 │         │
└─────────────────────────────────────────────────┼─────────┘
                                                  │
                              ┌────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   OPENCODE SERVER                             │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Agent     │  │    LLM      │  │   Tools     │          │
│  │   Runtime   │──│   Provider  │──│   Engine    │          │
│  └──────┬──────┘  └─────────────┘  └──────┬──────┘          │
│         │                                  │                  │
│         │    ┌─────────────┐    ┌─────────┴────────┐        │
│         ├───→│   Sessions  │    │  File Operations  │        │
│         │    │   Manager   │    │  (read/edit/bash)  │        │
│         │    └─────────────┘    └──────────────────┘        │
│         │                                                    │
│         │    ┌─────────────┐    ┌──────────────────┐        │
│         └───→│  Permission │    │  MCP / LSP        │        │
│              │   System    │    │  Integrations     │        │
│              └─────────────┘    └──────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              ↕
                    Local Filesystem / Git
```

### State Management

```typescript
// Connection Store
interface ConnectionStore {
  status: "disconnected" | "connecting" | "connected" | "error"
  serverUrl: string | null
  health: { healthy: boolean; version: string } | null
  connect: (url: string, password?: string) => Promise<void>
  disconnect: () => void
}

// Session Store
interface SessionStore {
  sessions: Session[]
  activeSessionId: string | null
  loading: boolean
  loadSessions: () => Promise<void>
  createSession: (title?: string) => Promise<Session>
  deleteSession: (id: string) => Promise<void>
  setActiveSession: (id: string) => void
}

// Message Store
interface MessageStore {
  messages: Map<string, { info: Message; parts: Part[] }[]>
  streaming: Map<string, { active: boolean; abortController: AbortController | null }>
  loadMessages: (sessionId: string) => Promise<void>
  sendMessage: (sessionId: string, text: string) => Promise<void>
  appendPart: (sessionId: string, part: Part) => void
}

// Permission Store
interface PermissionStore {
  pending: Array<{ id: string; sessionId: string; tool: string; input: any }>
  handlePermission: (sessionId: string, permissionId: string, response: "once" | "always" | "reject") => Promise<void>
}
```

---

## Setup & Development

### Prerequisites

```bash
# Install OpenCode CLI
curl -fsSL https://opencode.ai/install | bash

# Install Tauri prerequisites
# Rust: https://rustup.rs/
# Node.js: https://nodejs.org/ (LTS version)
# Windows: Microsoft C++ Build Tools + WebView2

# Verify installations
opencode --version
rustc --version
node -v
pnpm -v
```

### Clone & Install

```bash
# Clone the repository
git clone https://github.com/yourname/ganesha.git
cd ganesha

# Install dependencies
pnpm install
```

### Development

**Terminal 1: Start OpenCode Server**

```bash
opencode serve --port 4096 --cors http://localhost:1420
```

**Terminal 2: Start Tauri Dev**

```bash
pnpm tauri dev
```

This launches the app with hot-reload for the React frontend and auto-rebuild for Rust changes.

### Build

```bash
# Build for production
pnpm tauri build

# Output locations:
# macOS:   src-tauri/target/release/bundle/dmg/
# Windows: src-tauri/target/release/bundle/msi/
# Linux:   src-tauri/target/release/bundle/appimage/
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm tauri dev` | Start development mode with hot-reload |
| `pnpm tauri build` | Build production binaries |
| `pnpm tauri icon` | Generate app icons from source image |
| `pnpm dev` | Start Vite dev server only (no Tauri) |
| `pnpm build` | Build frontend only |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |

---

## Phased Development Plan

### Phase 1: Foundation (Weeks 1-2)

| Task | Details |
|------|---------|
| Tauri + React + Tailwind scaffold | Project setup, configuration, build pipeline |
| OpenCode SDK integration | Client wrapper, connection management |
| Server connection UI | Health check, URL input, auth flow |
| Credential storage | Rust keyring commands (save/load/clear) |
| Global SSE event stream | Event subscription, reconnection logic |

**Deliverable**: App launches, connects to OpenCode server, shows connection status.

### Phase 2: Core Chat (Weeks 3-4)

| Task | Details |
|------|---------|
| Session CRUD | List, create, delete, rename sessions |
| Message send/receive | Prompt async, SSE streaming |
| Markdown rendering | Code blocks, syntax highlighting, GFM |
| Message history pagination | Load older messages on scroll |
| Session sidebar | List, search, switch sessions |

**Deliverable**: Full chat loop — user sends message, agent responds with streamed text.

### Phase 3: Tool Visualization (Weeks 5-6)

| Task | Details |
|------|---------|
| Tool call cards | Read, grep, glob — collapsible with file previews |
| Diff viewer | Edit/write — inline diff with syntax highlighting |
| Bash output | Terminal-style block with command + output |
| Reasoning blocks | Collapsible thinking/reasoning display |

**Deliverable**: Tool calls render as interactive cards inside chat messages.

### Phase 4: Permissions & Control (Weeks 7-8)

| Task | Details |
|------|---------|
| Permission prompt UI | Inline card with allow/always/deny buttons |
| Permission reply flow | POST to permission endpoint |
| Session abort | Cancel streaming mid-response |
| Revert changes | Undo last agent modifications |
| Form request handling | Handle any form-type requests from agent |

**Deliverable**: Full permission flow works — user approves/denies tool execution.

### Phase 5: Polish & Integration (Weeks 9-10)

| Task | Details |
|------|---------|
| Settings panel | Server, model, theme, permissions config |
| Model switching | Dropdown from providers API, mid-session switch |
| MCP server management | Add/remove/status in settings |
| Keyboard shortcuts | Ctrl+N, Ctrl+K, Escape, etc. |
| System tray | Minimize to tray, notifications |
| Theme system | Dark/light toggle, CSS variables |
| File drag-drop | Attach files via drag-drop or @mention |

**Deliverable**: Polished app with all settings, shortcuts, and native integrations.

### Phase 6: Release (Week 11-12)

| Task | Details |
|------|---------|
| Cross-platform build | .dmg, .exe, .AppImage |
| Auto-updater | Tauri updater plugin + GitHub releases |
| Documentation | README, setup guide, screenshots |
| Testing | Manual QA on Windows, macOS, Linux |
| Open source prep | License, CONTRIBUTING.md, issue templates |

**Deliverable**: Production-ready release on GitHub.

---

## Problematic Areas

| Problem | Risk Level | Mitigation |
|---------|-----------|------------|
| **OpenCode API changes** | High | Pin SDK version, wrap API calls in adapter layer, monitor changelogs |
| **SSE reconnection handling** | Medium | Implement exponential backoff, event replay from last ID, connection status UI |
| **Large message history** | Medium | Virtualized lists (`react-window`), pagination, lazy load older messages |
| **Permission fatigue** | Medium | Smart defaults, "always allow for this project" option, batch similar permissions |
| **File path security** | Medium | Validate all paths server-side (OpenCode does this), never trust client paths |
| **Context window overflow** | Medium | Auto-compaction warnings, token usage display, manual compact button |
| **Cross-platform Tauri issues** | Low | Test on all targets early, use Tauri's cross-platform APIs |
| **Streaming latency** | Low | Direct SSE connection, no buffering layer |
| **Memory leaks from event listeners** | Low | Proper cleanup in React useEffect return functions |

---

## Risk Factors

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **OpenCode Server Dependency** | App is useless without running `opencode serve` | High | Bundle auto-start logic, clear setup docs, connection wizard |
| **API Breaking Changes** | OpenCode v2 is experimental | High | Version lock SDK, abstraction layer, pin to specific releases |
| **Single-Agent Limitation** | Power users may want multi-agent | Medium | Future phase could add agent switching UI |
| **No Built-in Editor** | Users can't manually edit files | Medium | "Open in default editor" links for file references |
| **LLM Costs** | Unrestricted tool use can burn tokens | Medium | Token usage display, budget alerts, cost estimation |
| **Platform-specific Bugs** | Tauri WebView differences | Low | Early cross-platform testing, use Tauri's abstraction APIs |
| **Credential Security** | API keys in memory | Low | Use OS keyring, clear on logout, never log secrets |

---

## Advantages

- **Leverages proven backend**: 182K+ stars, battle-tested agent runtime, no reinventing the wheel
- **Minimal UI cognitive load**: Chat-only interface reduces decision fatigue
- **Native desktop performance**: Tauri uses OS WebView, ~5MB bundle vs 200MB+ Electron
- **Secure**: Rust backend, OS keyring, no code execution in renderer
- **Extensible**: MCP ecosystem adds unlimited tools without UI changes
- **Cross-platform**: Single codebase for Windows, macOS, Linux
- **Type-safe**: Full TypeScript coverage via auto-generated SDK types
- **Real-time**: SSE streaming for instant feedback
- **Offline-capable**: Local server, no internet required after setup
- **Open source**: Community contributions, transparency, auditability

---

## Performance

| Aspect | Target | Strategy |
|--------|--------|----------|
| App startup | < 2s | Tauri native, lazy load sessions |
| Message streaming | < 100ms latency | Direct SSE, no buffering |
| History scroll | 60fps | Virtualized list, render 20 items |
| Memory usage | < 150MB | No embedded Chromium, OS WebView |
| Bundle size | < 10MB | Rust binary + minimal JS |
| API response | < 200ms | Direct SDK calls, no middleware |
| Event processing | < 10ms | Zustand immutable updates |
| File operations | Native speed | Agent handles via OpenCode server |

### Optimization Techniques

- **Virtualized message list**: Only render visible messages
- **Lazy session loading**: Fetch sessions on-demand
- **Debounced search**: Prevent excessive API calls during typing
- **Event batching**: Process SSE events in batches to avoid re-render storms
- **Memoized components**: React.memo on expensive renders
- **Code splitting**: Dynamic imports for settings panel and diff viewer

---

## Security

### Credential Storage

- **OS Keychain** (macOS), **Credential Manager** (Windows), **Secret Service** (Linux)
- Credentials never stored in plain text or config files
- Cleared on explicit logout

### API Authentication

- HTTP Basic Auth for local OpenCode server
- OAuth flows for provider keys (Anthropic, OpenAI, etc.)
- Tokens transmitted over HTTPS in production

### Content Security Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'self' http://localhost:* https:;
```

### Permission Gates

Every dangerous tool operation requires explicit user approval:

- `bash` — shell command execution
- `edit` — file modifications
- `write` — new file creation
- `webfetch` — external URL access

### Path Validation

- All file operations go through OpenCode server validation
- Never trust client-side paths
- External directory access requires explicit permission

### Sandboxed Execution

- React code runs in WebView sandbox
- No direct filesystem access from frontend
- All operations go through Tauri IPC or HTTP API

---

## Maintenance

### Auto-Update

- Tauri updater plugin checks GitHub releases
- Silent background download
- Prompt user to install on next launch

### Dependency Management

- Renovate/Dependabot for npm + Cargo dependencies
- Monthly dependency audit
- Pin critical dependencies

### OpenCode Compatibility

- Test against latest `opencode` CLI monthly
- Monitor OpenCode changelog for breaking changes
- SDK version lock with manual upgrade process

### Error Reporting

- Optional Sentry integration for crash analytics
- Structured logging to file
- Log rotation and cleanup

### Monitoring

- Health check on app start
- Connection status indicator
- SSE reconnection status

---

## Future Scope

| Feature | Description | Priority |
|---------|-------------|----------|
| **Multi-agent tabs** | Optional advanced mode for power users | Medium |
| **Voice input** | Whisper integration for speech-to-text | Low |
| **Custom themes** | Community theme marketplace | Low |
| **Plugin system** | Frontend plugins for custom message renderers | Medium |
| **Mobile companion** | React Native app sharing the same API layer | Low |
| **Collaborative sessions** | Real-time session sharing via OpenCode's share links | Medium |
| **Local LLM mode** | Direct integration with Ollama/LM Studio bypassing OpenCode server | High |
| **Session export** | Export chat as Markdown or PDF | Medium |
| **Snippet library** | Save and reuse common agent prompts | Low |
| **Cost tracker** | Real-time token usage and cost estimation | High |
| **Workspace profiles** | Switch between project configurations | Medium |
| **Git integration UI** | Commit, branch, diff visualization from chat | Medium |
| **Image support** | Paste/drag images into chat for vision models | Medium |
| **Multi-window** | Multiple chat windows for different projects | Low |

---

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
