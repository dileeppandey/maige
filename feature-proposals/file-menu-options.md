# File Menu Options

**Status:** Proposal  
**Date:** December 25, 2025

## Overview

Expand the File menu in the application toolbar to include essential file operations, import/export functionality, and batch processing capabilities. Currently, the File menu only contains "Close Window."

---

## Goals

- **Familiar UX**: Match conventions from Lightroom/Photoshop that users expect
- **Non-destructive workflow**: All edits are saved separately from originals
- **Flexible export**: Multiple format and quality options
- **Productivity**: Quick keyboard shortcuts for common actions

---

## Proposed Menu Structure

```
File
├── Open Folder...              ⌘O
├── Open Recent                 →  [submenu]
├── Close Folder                ⇧⌘W
├── Close Window                ⌘W
├── ─────────────────────────────
├── Import Images...            ⇧⌘I
├── ─────────────────────────────
├── Save Edits                  ⌘S
├── Revert to Original
├── ─────────────────────────────
├── Export...                   ⌘E
├── Export As...                ⇧⌘E
├── Quick Export (JPEG)         ⌘⇧J
├── ─────────────────────────────
├── Export Selected...
├── Sync Settings to Selected
└── ─────────────────────────────
```

---

## Feature Details

### 1. Open Folder / Open Recent

| Feature | Description |
|---------|-------------|
| **Open Folder** | Existing functionality, moved to menu with `⌘O` shortcut |
| **Open Recent** | Submenu showing last 10 opened folders with full paths |
| **Close Folder** | Clears workspace without quitting app |

**Implementation Notes:**
- Store recent folders in `electron-store` or similar
- Show folder name with path in tooltip

---

### 2. Import Images

| Feature | Description |
|---------|-------------|
| **Import Images** | File picker for selecting individual images (vs entire folder) |
| **Supported formats** | JPG, PNG, WebP, RAW formats (CR2, ARW, DNG, NEF, etc.) |

**Implementation Notes:**
- Use Electron's `dialog.showOpenDialog` with `multiSelections` property
- Add imported images to current workspace

---

### 3. Save / Revert

| Feature | Description |
|---------|-------------|
| **Save Edits** | Persist current adjustments to local database or `.xmp` sidecar |
| **Revert to Original** | Discard all adjustments for selected image |

**Implementation Notes:**
- Non-destructive: Never modify original files
- Options for storage:
  - SQLite database (current `useEditStore` approach)
  - XMP sidecar files (industry standard, portable)

---

### 4. Export Options

| Feature | Shortcut | Description |
|---------|----------|-------------|
| **Export** | `⌘E` | Export with last-used settings |
| **Export As** | `⇧⌘E` | Full dialog with format/quality/size options |
| **Quick Export** | `⌘⇧J` | One-click JPEG export to same folder |

**Export Dialog Options:**
```
┌─────────────────────────────────────────────┐
│ Export Settings                             │
├─────────────────────────────────────────────┤
│ Format:    [JPEG ▼]  PNG | WebP | TIFF      │
│ Quality:   [========●==] 80%                │
│ Resize:    [ ] Resize to fit               │
│            Width [____] Height [____]       │
│ Output:    [📁 Choose Folder...]            │
│ Naming:    [Original name ▼] + suffix       │
├─────────────────────────────────────────────┤
│            [Cancel]  [Export]               │
└─────────────────────────────────────────────┘
```

**Implementation Notes:**
- Use `sharp` for format conversion and resizing
- Apply current adjustments during export
- Save export presets for repeated use

---

### 5. Batch Operations

| Feature | Description |
|---------|-------------|
| **Export Selected** | Export multiple selected images with same settings |
| **Sync Settings** | Copy current image's adjustments to all selected images |

**Implementation Notes:**
- Requires multi-select in filmstrip (future feature)
- Show progress bar for batch exports
- Use `worker_threads` for parallel processing

---

## Implementation Phases

### Phase 1: Core Menu & Shortcuts
- [ ] Create Electron menu template in `main.ts`
- [ ] Add keyboard shortcuts for existing actions
- [ ] Implement Open Recent with persistent storage
- [ ] Add Close Folder functionality

### Phase 2: Export Foundation
- [ ] Create Export dialog component
- [ ] Implement single-image export with `sharp`
- [ ] Apply adjustments during export pipeline
- [ ] Quick Export with default settings

### Phase 3: Export Polish
- [ ] Export As with full options
- [ ] Export presets (save/load settings)
- [ ] Resize options
- [ ] Output folder selection

### Phase 4: Batch & Persistence
- [ ] Multi-select in filmstrip
- [ ] Batch export with progress
- [ ] Sync settings to multiple images
- [ ] XMP sidecar support (optional)

---

## Technical Implementation

### Menu Template (Electron)

```typescript
// electron/main.ts
import { Menu, MenuItem } from 'electron';

const fileMenu: MenuItemConstructorOptions = {
  label: 'File',
  submenu: [
    { label: 'Open Folder...', accelerator: 'CmdOrCtrl+O', click: handleOpenFolder },
    { label: 'Open Recent', submenu: buildRecentMenu() },
    { type: 'separator' },
    { label: 'Close Folder', accelerator: 'Shift+CmdOrCtrl+W', click: handleCloseFolder },
    { label: 'Close Window', accelerator: 'CmdOrCtrl+W', role: 'close' },
    { type: 'separator' },
    { label: 'Export...', accelerator: 'CmdOrCtrl+E', click: handleExport },
    { label: 'Export As...', accelerator: 'Shift+CmdOrCtrl+E', click: handleExportAs },
  ]
};
```

### IPC Channels Needed

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `file:export` | Renderer → Main | Trigger export with settings |
| `file:exportProgress` | Main → Renderer | Report export progress |
| `file:openRecent` | Renderer → Main | Open a recent folder |
| `file:getRecent` | Renderer → Main | Get recent folders list |

---

## Dependencies

| Package | Purpose | Already Installed? |
|---------|---------|-------------------|
| `sharp` | Image processing & export | ✅ Yes |
| `electron-store` | Persist recent folders | ❌ No |

---

## Open Questions

1. **Sidecar vs Database** — Should edits be stored in XMP sidecars (portable) or SQLite (faster)?
2. **Export location** — Default to source folder or ask every time?
3. **Filename conflicts** — Overwrite, add suffix, or prompt user?
4. **Multi-select UI** — Ctrl+click or checkbox-based selection?

---

## References

- [Electron Menu API](https://www.electronjs.org/docs/latest/api/menu)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [Adobe XMP Specification](https://www.adobe.com/devnet/xmp.html)
