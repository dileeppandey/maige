# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Maige** is a professional desktop image editor built on Tauri 2 with a native Rust image processing backend (~15MB bundle, ~30-50MB memory).

## Development Commands

### Tauri
```bash
npm run tauri:dev      # Start Tauri dev mode (also starts frontend)
npm run tauri:build    # Production Tauri build
```

### Frontend Only
```bash
npm run dev            # Vite dev server only (localhost:5173)
npm run build          # TypeScript check + Vite build
```

### Code Quality
```bash
npm run lint           # ESLint
```

### Rust
```bash
cd src-tauri && cargo build          # Build Tauri backend
cd src-tauri && cargo check          # Fast type-check
cd rust/maige-core && cargo build    # Build shared Rust library
cargo test                           # Run Rust tests (from either Rust dir)
```

## Architecture

### Frontend ↔ Backend Bridge

The frontend communicates with Tauri through `src/bridge.ts`, which provides `window.api` and delegates every call to Tauri's `invoke()`.

- **Call path:** `window.api` methods → `src/bridge.ts` → Tauri `invoke()` → `src-tauri/src/commands.rs`
- **Image loading:** Local files are served via Tauri's asset protocol. Use `assetUrl()` from `src/utils/assetUrl.ts` (wraps `convertFileSrc`) — never use raw file paths or `media://`.
- **Serialization:** Rust structs serialize to **snake_case** JSON (no `rename_all`). Frontend shared types in `shared/types.ts` use snake_case to match.

### Frontend (`src/`)

- **`App.tsx`** — Root component. Manages view modes (library, people, cluster, duplicates, album, search), orchestrates the three-panel layout (left panel → center image preview → right adjustments), and wires up Zustand stores.
- **State:** Three Zustand stores in `src/store/`:
  - `useEditStore.ts` — current image adjustments and editing state
  - `useLibraryStore.ts` — library images, albums, search, selection
  - `useUIStore.ts` — panel visibility, UI toggles
- **`src/processing/`** — Client-side image processing (MediaPipe face detection, canvas-based adjustments)
- **`src/hooks/`** — Custom hooks for face detection, canvas processing

### Tauri Backend (`src-tauri/src/`)

- **`main.rs`** — App initialization, native menu with keyboard shortcuts, plugin registration (shell, dialog, fs), DB init (blocking), 39 command handlers registered
- **`commands.rs`** — All IPC handlers delegating to `database::*` functions
- **`database.rs`** — rusqlite wrapper; DB at `{app_data_dir}/maige.db`; tables: `images`, `albums`, `album_images`, `people`, `faces`, `tags`, `image_tags`, `presets`. Includes duplicate detection (Hamming distance on pHash) and face thumbnail cropping.
- **`image_processor.rs`** — Native image processing (wraps logic from `rust/maige-core`)

### Tauri 2 Capabilities

Permissions for Tauri plugins are granted in `src-tauri/capabilities/default.json`. If a plugin call silently returns null/fails, check that its permission is listed there.

### Shared Rust Library (`rust/maige-core/`)

- **`processor.rs`** — `ImageProcessor` struct: load, apply adjustments, compute histogram/phash
- **`adjustments.rs`** — Light and color adjustments, processed in parallel with rayon
- **`phash.rs`** — dHash perceptual hashing for duplicate detection

All adjustment values range from -100 to 100.

## Key Tech

| Concern | Library |
|---|---|
| UI | React 19 + Tailwind CSS 3 |
| State | Zustand 5 |
| Build | Vite 7 |
| Desktop | Tauri 2 |
| DB | rusqlite (bundled SQLite) |
| Image processing | Rust (`image` crate) + rayon |
| Face detection | MediaPipe Tasks Vision |
| Virtualization | react-virtuoso |
| Animation | framer-motion |
