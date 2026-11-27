# Framecraft — Visual App & UI Editor

Framecraft is a browser-based visual app and UI editor with a live interactive preview and two-way code synchronization. Load starter templates, local folders, ZIP archives, or GitHub repositories, inspect and edit layout/styling directly on the canvas, and export or push clean changes back to disk or GitHub.

---

## Features

- **Project Start Hub & Multi-Source Import**
  - Launch from categorized starter templates (`Landing Page`, `SaaS Dashboard`, `Portfolio`, `App Shell`, and more).
  - Open local project folders or files via drag-and-drop or the browser File System Access API (with live write-back to disk).
  - Pull repositories directly from GitHub via OAuth (`PKCE S256`), a Personal Access Token (PAT), public `@username` browsing, or repository URL.
- **Live Interactive Preview & In-Browser Bundling**
  - Compiles both static HTML/CSS/JS sites and multi-file React/TypeScript/Vite apps in the browser using `esbuild-wasm` (with an Express `esbuild` server fallback at `/api/bundle-project`).
  - Automatically extracts CSS & CSS Modules, resolves local/public images, SVGs, fonts, `?raw`/`?url` imports, builds `esm.sh` import maps from `package.json`, and shims common Vite/PWA virtual modules.
  - Switch seamlessly between **Editing Mode** (visual selection, drag-move, 8-handle resize, snap guides, inline text editing) and **Using Mode** (normal app interaction), across Desktop, Tablet, and Mobile viewports and zoom levels (`Fit`, `50%`, `75%`, `100%`, `125%`).
- **Two-Way Code Sync & Visual Inspector**
  - **Layout & Spacing:** Display (`block`, `flex`, `grid`, `inline-flex`, etc.), Flexbox/Grid alignment (`justify-content`, `align-items`, `flex-wrap`, `grid-template-columns`), `position` (`static`, `relative`, `absolute`, `fixed`, `sticky`) + offset reset, Width/Height quick presets (`Auto`, `100%`, `Fit`), `Max Width`, `Overflow`, aspect-ratio lock, and an expandable 4-side Margin & Padding editor with canvas spacing overlays.
  - **Typography, Color & Components:** 25+ curated Google Fonts (automatically linked into `<head>`), inline color pickers with live hex draft editing, SVG shape editing, table row/column/style controls, responsive `@media` overrides, `:root` CSS variables (`Global Styles`), `<head>` SEO & OpenGraph metadata editor, and a live DOM outline tree.
  - **Code Editor & Undo/Redo:** Built-in source editor with jump-to-element location, file tree search/create/delete, full undo/redo history, and `localStorage` workspace autosave.
- **GitHub Sync & Export**
  - Switch branches, pull/merge upstream updates while preserving extra local files, commit and push changes, or enable Instant Auto-Sync.
  - Export the full workspace as a ZIP archive or save individual files anytime.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, `lucide-react`, `motion`, `jszip`, `esbuild-wasm`
- **Backend (`server.ts`):** Node.js, Express 4 (runs Vite in `middlewareMode` during development and serves `dist/` in production on port `3000`), `esbuild`
- **Desktop Wrapper:** Electron (`electron/main.cjs`) loading the built `dist/index.html`

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **npm**

### Install & Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the Express + Vite development server on port `3000` (`tsx server.ts`) |
| `npm run build` | Builds the production frontend bundle into `dist/` (`vite build`) |
| `npm run start` | Starts the production server serving `dist/` (`node server.ts`) |
| `npm run lint` | Runs TypeScript typechecking (`tsc --noEmit`) |
| `npx tsx --test src/utils/editorLogic.test.ts` | Runs the unit & integration test suite |

---

## Environment Variables

Copy `.env.example` to `.env` (or configure environment secrets) as needed:

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth App / GitHub App Client ID for 1-click OAuth sign-in |
| `GITHUB_CLIENT_SECRET` | Optional when PKCE (`S256`) is used; used by traditional OAuth exchanges if set |
| `GITHUB_OAUTH_CALLBACK_URL` | Optional custom/external server OAuth callback URL (defaults to `<origin>/auth/github/callback`) |
| `VITE_GITHUB_OAUTH_CALLBACK_URL` | Optional frontend-allowed origin for external OAuth callback `postMessage` handshakes |
| `GITHUB_TOKEN` | Optional server-side fallback GitHub token for local setups |
| `APP_URL` | Optional canonical application URL |
| `GEMINI_API_KEY` | Optional server-side API key environment slot |

### GitHub Authentication Notes

- **OAuth (PKCE `S256`):** Uses single-use CSRF `state`, client handshake nonces, origin/window source checks, and single-use `S256` code verifiers. Register `<your-app-origin>/auth/github/callback` as the Authorization callback URL in your GitHub App settings.
- **Personal Access Token (PAT):** Users can paste a PAT with `repo` (or Contents read/write) scope directly in **Start Hub**, **Sync to GitHub**, or **Commit** without setting up an OAuth app. Client PATs and session tokens stay strictly in memory and are never written to `localStorage`.
- **Public Username Browse:** Browsing public repositories by `@username` is read-only; pushing commits requires connecting via OAuth or entering a PAT with write permission.

---

## Server API Endpoints

- `GET /esbuild.wasm` — Serves the WebAssembly binary for in-browser bundling
- `POST /api/bundle-project` — Server-side `esbuild` fallback bundler (rate-limited & validated)
- `GET /api/auth/github/status` — Returns OAuth configuration status and resolved callback URL
- `GET /api/auth/github/url` — Issues a CSRF-protected PKCE `S256` GitHub authorization URL
- `GET /auth/github/callback` — Handles the GitHub OAuth callback inside a CSP-hardened popup
- `POST /api/auth/github/exchange` — Verifies the PKCE `code_verifier` and exchanges the code for an in-memory session token
- `POST /api/auth/github/logout` — Revokes the in-memory session token
- `GET /api/github/repos` — Lists authenticated user repositories
- `GET /api/github/users/:username/repos` — Lists public repositories for a GitHub username
- `GET /api/github/repos/:owner/:repo/branches` — Lists branches for a repository
- `POST /api/github/pull` — Downloads and extracts a repository branch archive
- `POST /api/github/push` — Creates blobs, tree, commit, and updates the target branch ref

---

## Project Structure

- `server.ts`, `serverBundler.ts`, `serverGithub.ts`, `serverOAuth.ts` — Express server, native bundler fallback, GitHub REST API integration, and PKCE OAuth state/callback handlers
- `src/App.tsx` — Main workspace coordinator, history/autosave state, preview compilation, and two-way sync handlers
- `src/components/` — UI workspace components (`StartHub`, `TopToolbar`, `CanvasWorkspace`, `FileExplorer`, `ElementsPalette`, `RightStudioPanel`, `InspectorPanel`, `DomOutlineTree`, `GlobalStylesPanel`, `SeoMetaPanel`, `GitHubSyncModal`, `CommandPaletteModal`, `ShortcutsModal`)
- `src/utils/` — Pure editor engines (`browserBundler`, `projectBundler`, `iframeBridge`, `htmlSync`, `reactVisualSync`, `codeSync`, `cssVariables`, `responsiveCss`, `seoMeta`, `fontLibrary`, `githubSync`, `serverValidation`, `fileSystemSync`, `exportProject`, `historyManager`, `shortcuts`)
- `src/types/editor.ts` — Shared TypeScript interfaces for files, elements, styles, and editor state
- `electron/main.cjs` & `.github/workflows/build-exe.yml` — Electron desktop entry point and Windows executable workflow
