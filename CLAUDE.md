# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Maige** is a professional desktop image editor built on Tauri 2 with a native Rust image processing backend (~15MB bundle, ~30-50MB memory).

## Development Commands

```bash
npm run tauri:dev      # Start Tauri dev mode (starts both frontend + backend)
npm run tauri:build    # Production Tauri build
npm run dev            # Vite dev server only (localhost:5173, no Tauri backend)
npm run build          # TypeScript check + Vite build
npm run lint           # ESLint
```

```bash
cd crates/maige-tauri && cargo check   # Fast type-check Tauri backend
cd crates/maige-tauri && cargo build   # Build Tauri backend
cd crates/maige-core && cargo build    # Build shared Rust library
cargo test                             # Run Rust tests (from crates/maige-tauri/ or crates/maige-core/)
```

Note: `cargo check`/`build` for `crates/maige-tauri` requires Tauri's native GTK/WebKitGTK dev libraries (`libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, etc. on Linux); it will fail with a `pkg-config`/`gdk-3.0 not found` error in environments that lack them (e.g. minimal containers). `crates/maige-core` has no such dependency and checks/builds standalone.

**Rust toolchain requirement:** The Cargo.lock requires Rust 1.85+ (uses `serde_spanned 1.1.1` which needs edition 2024). Run `rustup update` if `cargo check` fails with an "edition2024 is required" error.

There are no frontend tests (no Vitest/Jest setup exists).

## Architecture

### Frontend ↔ Backend Bridge

**Call path:** UI component → Zustand store → `window.api` (`ui/bridge.ts`) → Tauri `invoke()` → `crates/maige-tauri/src/commands.rs` → `database.rs`

`ui/bridge.ts` is the sole contract between frontend and backend — it defines all 40+ IPC commands and event listeners as typed methods on `window.api`.

**Image loading:** Always use `assetUrl()` from `ui/utils/assetUrl.ts` (wraps `convertFileSrc`). Never use raw file paths or `media://`. Pass `imageCacheVersion` from the library store as the second argument when displaying images that may have been modified, to force cache invalidation.

**Serialization:** Rust structs serialize to **snake_case** JSON by serde default (no `rename_all`). All TypeScript types in `shared/types.ts` use snake_case to match. When adding new Rust struct fields, the TypeScript side must use the same snake_case name — do not convert to camelCase.

### Frontend (`ui/`)

- **`App.tsx`** — Root component. Manages view modes (`library`, `search`, `tag`, `people`, `cluster`, `duplicates`, `album`), orchestrates the three-panel layout (left panel → center image preview → right adjustments), and wires up Zustand stores.
- **Zustand stores** in `ui/store/`:
  - `useEditStore.ts` — Per-image adjustment state (Map keyed by filePath), presets, clipboard
  - `useLibraryStore.ts` — Library images, albums, selection (`Set<number>` of IDs), search, view modes, `imageCacheVersion`
  - `useUIStore.ts` — Panel visibility, zoom level, compare mode, UI toggles
  - `useSettingsStore.ts` — App preferences (export defaults, AI provider config, interface defaults), persisted via `settings` table
  - `useChatStore.ts` — AI chat panel state/history
- **`ui/processing/`** — Canvas-based pixel manipulation (`ImageProcessor.ts`) and MediaPipe face detection wrapper (`faceDetector.ts`)
- **`ui/hooks/`** — `useCanvasProcessor.ts` (renders adjusted image to canvas for live preview, computes histogram, debounces adjustments), plus `useFaceDetection.ts`, `useImageAdjustments.ts`, `useImageViewer.ts`, `useSceneAnalysis.ts`
- **`ui/components/chat/`** — AI assistant panel (`ChatPanel.tsx`), recipe/preset management (`RecipeManager.tsx`), and region selection for targeted edits (`RegionSelector.tsx`)
- **`PreferencesModal.tsx`** — General/AI Assistant/Interface settings UI backed by `useSettingsStore`

### Tauri Backend (`crates/maige-tauri/src/`)

- **`main.rs`** — App initialization, native menu (with keyboard shortcuts), plugin registration (shell, dialog, fs), synchronous DB init, registers all command handlers
- **`commands.rs`** — All IPC handlers; thin delegation layer to `database::*`, `image_processor::*`, `face_recognition::*`, and `ai_chat::*` functions
- **`database.rs`** — rusqlite wrapper; DB at `{app_data_dir}/maige.db`; tables: `images`, `albums`, `album_images`, `people`, `faces`, `tags`, `image_tags`, `presets`, `settings`, `chat_messages`. Duplicate detection via Hamming distance on pHash. Face thumbnail cropping on save.
- **`image_processor.rs`** — Image loading, EXIF metadata extraction, phash generation, full 10-adjustment processing and export (parallel via rayon)
- **`face_recognition.rs`** — Face embedding storage and clustering (`cluster_faces` command: pairwise cosine distance, average-linkage grouping)
- **`ai_chat.rs`** — AI assistant backend (Ollama-backed natural-language editing/scene analysis; provider is configurable via `useSettingsStore`)

### Shared Rust Library (`crates/maige-core/`)

Pure library with no Tauri dependencies — usable independently. `crates/maige-tauri` now depends on it directly (`Cargo.toml`: `maige-core = { path = "../maige-core" }`).

- **`processor.rs`** — `ImageProcessor` struct: load image, apply adjustments, export, compute histogram/phash
- **`adjustments.rs`** — All light + color adjustments, parallelized with rayon
- **`phash.rs`** — dHash perceptual hashing for duplicate detection
- **`metadata.rs`**, **`histogram.rs`**, **`scanner.rs`**, **`error.rs`** — EXIF metadata, histogram computation, folder scanning, shared error types

All adjustment values use a **-100 to 100 scale** in both Rust and TypeScript. Clamping happens in the UI sliders and in each algorithm's implementation.

### Tauri 2 Capabilities

Permissions for Tauri plugins are granted in `crates/maige-tauri/capabilities/default.json`. If a plugin call silently returns null or fails, the permission is likely missing from this file.

## Key Patterns & Gotchas

**Export pipeline uses Rust backend:** `ExportModal` receives `imagePath` (raw file path) and `adjustments`, calls `window.api.exportImage({ sourcePath, outputPath, adjustments, format, quality })`, which invokes the Rust `export_image` command. The canvas is for live preview only; Rust processes the full-res image for export.

**`filePath` vs `src` in `ImageViewer`:** `src` is the Tauri asset URL (for display), `filePath` is the raw file path (for export/write). `ImagePreview` passes both from `selectedFile`: `src={assetUrl(selectedFile.path)}` and `filePath={selectedFile.path}`.

**Split face detection:** MediaPipe detection runs in the browser (frontend), results are stored in the Tauri backend via `save_face_detections`. The backend handles storage and cropping; the frontend handles detection UI. Clustering (`clusterFaces()` in `bridge.ts` → `cluster_faces` command) is implemented server-side in `face_recognition.rs`, but the frontend's cluster-progress indicator in `PeoplePanel.tsx` is never driven (its setter is unused) — clustering runs without incremental progress feedback.

**Import progress events:** Folder import emits `import-progress` events from Rust (`app.emit("import-progress", ...)`) that the frontend subscribes to via `window.api.onImportProgress()`. Format: `{ current: number; total: number; file: string }`.

**Luminance coefficients differ between frontend and Rust:** Frontend (`ImageProcessor.ts`) uses `0.299R + 0.587G + 0.114B` (perceived luminance); Rust (`image_processor.rs`, `maige-core`) uses `0.2126R + 0.7152G + 0.0722B` (CIE standard). This causes slight visual differences between live preview and export.

**No DB migration system:** Schema is hardcoded in `database.rs`. Adding new tables requires both schema changes and manual handling of existing databases that lack the new tables.

**Selection uses `Set<number>`:** Image selection in `useLibraryStore` is a `Set` of integer IDs, not an array. Bulk operations (rating, flagging, adding to album) operate on this set.

**`addingToAlbumId`:** A special UI state in `useLibraryStore` that puts the library into "pick images for album" mode. Setting it changes how selection behaves across view modes.

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
