# Maige

A professional desktop image editor built with Tauri 2 and native Rust image processing.

## Features

- **Non-destructive Editing** — Exposure, contrast, highlights, shadows, whites, blacks, temperature, tint, saturation, vibrance
- **Real-time Histogram** — Live RGB and luminance histogram
- **Library Management** — Import folders, browse and organize photos
- **Album Organization** — Create albums to group your photos
- **Duplicate Detection** — Perceptual hashing (dHash) to find similar images
- **People Detection** — Face detection via MediaPipe with person grouping
- **Semantic Search** — Search images by content
- **Gallery & Editor Views** — Grid gallery with single-image editor and filmstrip
- **Native App Menu** — Full keyboard shortcuts for all operations
- **Lightweight** — ~15MB bundle, ~30-50MB memory usage

## Technology Stack

| Concern | Library |
|---------|---------|
| Desktop framework | Tauri 2 |
| UI | React 19 + Tailwind CSS |
| State management | Zustand 5 |
| Build tool | Vite 7 |
| Database | rusqlite (bundled SQLite) |
| Image processing | Rust (`image` crate + rayon) |
| Face detection | MediaPipe Tasks Vision |
| Virtualization | react-virtuoso |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) (latest stable)
- Platform-specific Tauri dependencies — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Installation

```bash
git clone https://github.com/dileeppandey/maige.git
cd maige
npm install
```

### Development

```bash
npm run tauri:dev
```

This starts both the Vite dev server and the Tauri backend.

### Production Build

```bash
npm run tauri:build
```

## Project Structure

```
maige/
├── src/                        # React frontend
│   ├── components/             # UI components (panels, gallery, viewer, modals)
│   ├── store/                  # Zustand stores (edit, library, UI)
│   ├── processing/             # Client-side image processing (canvas, face detection)
│   ├── hooks/                  # Custom hooks (canvas processor, face detection)
│   ├── bridge.ts               # Tauri API bridge (window.api → invoke())
│   └── utils/                  # Utilities (asset URL conversion)
│
├── src-tauri/                  # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs             # App entry, native menu, plugin setup
│   │   ├── commands.rs         # IPC command handlers (39 commands)
│   │   ├── database.rs         # SQLite schema and CRUD operations
│   │   └── image_processor.rs  # Native image processing
│   ├── capabilities/           # Tauri 2 permission grants
│   └── tauri.conf.json         # Tauri configuration
│
├── rust/maige-core/            # Shared Rust image processing library
│   └── src/
│       ├── adjustments.rs      # Light & color adjustments (parallel via rayon)
│       ├── phash.rs            # Perceptual hashing for duplicate detection
│       └── processor.rs        # ImageProcessor: load, process, histogram
│
└── shared/                     # Shared TypeScript types
    └── types.ts
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run tauri:dev` | Start Tauri in development mode |
| `npm run tauri:build` | Build production app |
| `npm run dev` | Vite dev server only (frontend) |
| `npm run build` | TypeScript check + Vite build |
| `npm run lint` | Run ESLint |

## Performance

Native Rust image processing provides significant speedups over JavaScript:

| Operation | JavaScript | Rust | Speedup |
|-----------|------------|------|---------|
| Perceptual Hash | ~50ms | ~5ms | **10x** |
| Image Adjustments | ~100ms | ~10ms | **10x** |
| Histogram | ~30ms | ~3ms | **10x** |

## License

MIT
