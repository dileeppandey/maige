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
cd src-tauri && cargo check          # Fast type-check Tauri backend
cd src-tauri && cargo build          # Build Tauri backend
cd rust/maige-core && cargo build    # Build shared Rust library
cargo test                           # Run Rust tests (from src-tauri/ or rust/maige-core/)
```

**Rust toolchain requirement:** The Cargo.lock requires Rust 1.85+ (uses `serde_spanned 1.1.1` which needs edition 2024). Run `rustup update` if `cargo check` fails with an "edition2024 is required" error.

There are no frontend tests (no Vitest/Jest setup exists).

## Architecture

### Frontend ↔ Backend Bridge

**Call path:** UI component → Zustand store → `window.api` (`src/bridge.ts`) → Tauri `invoke()` → `src-tauri/src/commands.rs` → `database.rs`

`src/bridge.ts` is the sole contract between frontend and backend — it defines all 40+ IPC commands and event listeners as typed methods on `window.api`.

**Image loading:** Always use `assetUrl()` from `src/utils/assetUrl.ts` (wraps `convertFileSrc`). Never use raw file paths or `media://`. Pass `imageCacheVersion` from the library store as the second argument when displaying images that may have been modified, to force cache invalidation.

**Serialization:** Rust structs serialize to **snake_case** JSON by serde default (no `rename_all`). All TypeScript types in `shared/types.ts` use snake_case to match. When adding new Rust struct fields, the TypeScript side must use the same snake_case name — do not convert to camelCase.

### Frontend (`src/`)

- **`App.tsx`** — Root component. Manages view modes (`library`, `search`, `tag`, `people`, `cluster`, `duplicates`, `album`), orchestrates the three-panel layout (left panel → center image preview → right adjustments), and wires up Zustand stores.
- **Three Zustand stores** in `src/store/`:
  - `useEditStore.ts` — Per-image adjustment state (Map keyed by filePath), presets, clipboard
  - `useLibraryStore.ts` — Library images, albums, selection (`Set<number>` of IDs), search, view modes, `imageCacheVersion`
  - `useUIStore.ts` — Panel visibility, zoom level, compare mode, UI toggles
- **`src/processing/`** — Canvas-based pixel manipulation (`ImageProcessor.ts`) and MediaPipe face detection wrapper (`faceDetector.ts`)
- **`src/hooks/useCanvasProcessor.ts`** — Renders adjusted image to canvas for live preview, computes histogram, debounces adjustments

### Tauri Backend (`src-tauri/src/`)

- **`main.rs`** — App initialization, native menu (39 items with keyboard shortcuts), plugin registration (shell, dialog, fs), synchronous DB init, registers all command handlers
- **`commands.rs`** — All IPC handlers; thin delegation layer to `database::*` and `image_processor::*` functions
- **`database.rs`** — rusqlite wrapper; DB at `{app_data_dir}/maige.db`; tables: `images`, `albums`, `album_images`, `people`, `faces`, `tags`, `image_tags`, `presets`. Duplicate detection via Hamming distance on pHash. Face thumbnail cropping on save.
- **`image_processor.rs`** — Image loading, EXIF metadata extraction, phash generation, full 10-adjustment processing and export (parallel via rayon)

### Shared Rust Library (`rust/maige-core/`)

Pure library with no Tauri dependencies — usable independently. Currently not depended on by `src-tauri` (Rust 1.80 can't resolve its transitive deps); the adjustment algorithms in `src-tauri/src/image_processor.rs` mirror `maige-core/src/adjustments.rs`.

- **`processor.rs`** — `ImageProcessor` struct: load image, apply adjustments, export, compute histogram/phash
- **`adjustments.rs`** — All light + color adjustments, parallelized with rayon
- **`phash.rs`** — dHash perceptual hashing for duplicate detection

All adjustment values use a **-100 to 100 scale** in both Rust and TypeScript. Clamping happens in the UI sliders and in each algorithm's implementation.

### Tauri 2 Capabilities

Permissions for Tauri plugins are granted in `src-tauri/capabilities/default.json`. If a plugin call silently returns null or fails, the permission is likely missing from this file.

## Key Patterns & Gotchas

**Export pipeline uses Rust backend:** `ExportModal` receives `imagePath` (raw file path) and `adjustments`, calls `window.api.exportImage({ sourcePath, outputPath, adjustments, format, quality })`, which invokes the Rust `export_image` command. The canvas is for live preview only; Rust processes the full-res image for export.

**`filePath` vs `src` in `ImageViewer`:** `src` is the Tauri asset URL (for display), `filePath` is the raw file path (for export/write). `ImagePreview` passes both from `selectedFile`: `src={assetUrl(selectedFile.path)}` and `filePath={selectedFile.path}`.

**Split face detection:** MediaPipe detection runs in the browser (frontend), results are stored in the Tauri backend via `save_face_detections`. The backend handles storage and cropping; the frontend handles detection and clustering UI. Face clustering (`clusterFaces()` in `bridge.ts`) is a stub — not yet implemented.

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
