# Professional Mac Menu Bar Proposal

**Status:** Proposal  
**Date:** December 25, 2025 (Updated: December 28, 2025)

## Overview

This proposal outlines a comprehensive macOS-compliant menu bar structure. By distributing functionality across specialized top-level menus, we ensure the **File** and **Edit** menus remain clean and predictable, while providing direct access to advanced **Develop**, **Library**, and **Metadata** features.

---

## Proposed Menu Bar Layout

### 📁 File (Data Management)
*Focus: File lifecycle and external interaction.*

```
File
├── Open Folder...              ⌘O
├── Open Recent                 → [last 10 folders]
├── Close Folder                ⇧⌘W
├── Close Window                ⌘W
├── ─────────────────────────────
├── Import Images...            ⇧⌘I
├── ─────────────────────────────
├── Export...                   ⌘E
├── Export As...                ⇧⌘E
├── Quick Export (JPEG)         ⌥⇧J
├── ─────────────────────────────
├── Page Setup...               ⇧⌘P
├── Print...                    ⌘P
├── ─────────────────────────────
├── Show in Finder              ⇧⌘R
├── Move to Trash               ⌘⌫
```

---

### ✏️ Edit (General Operations)
*Focus: Standard history and text manipulation.*

```
Edit
├── Undo                        ⌘Z
├── Redo                        ⇧⌘Z
├── ─────────────────────────────
├── Cut                         ⌘X
├── Copy                        ⌘C
├── Paste                       ⌘V
├── Delete                      ⌫
├── ─────────────────────────────
├── Select All                  ⌘A
├── Deselect All                ⇧⌘A
├── Invert Selection            ⌘I
```

---

### 📚 Library (Organization)
*Focus: High-level organization and AI-driven features.*

```
Library
├── New Album                   ⌘N
├── Add to Album...             ⌥⌘A
├── Remove from Album           ⌥⌘⌫
├── ─────────────────────────────
├── Analyze Folder...           ⌥⇧A
├── Find Duplicates...
├── Semantic Search             ⌘F
├── ─────────────────────────────
├── Sort By                     → [Date, Name, Rating]
├── Filter By                   → [Flagged, Unflagged]
```

---

### 🛠️ Develop (Image Processing)
*Focus: Editing workflow and adjustment syncing.*

```
Develop
├── Copy Adjustments            ⌥⌘C
├── Paste Adjustments           ⌥⌘V
├── Copy Colors Only            ⌥⇧⌘C
├── ─────────────────────────────
├── Sync Settings to Selected   ⇧⌘S
├── Reset All Adjustments       ⇧⌘R
├── Revert to Original
├── ─────────────────────────────
├── Create Virtual Copy         ⌘'
├── ─────────────────────────────
├── Settings
│   ├── Previous Edit           ⌘[
│   └── Next Edit               ⌘]
```

---

### 🏷️ Metadata (Information)
*Focus: Tagging, EXIF data, and labeling.*

```
Metadata
├── Get Info                    ⌘I
├── Show Adjustments Panel      ⌘D
├── ─────────────────────────────
├── Add Keywords...             ⌘K
├── Edit Caption...             ⇧⌘K
├── ─────────────────────────────
├── Set Rating
│   ├── 0 to 5 Starts           [0-5]
│   └── Flag/Reject             [P / U / X]
├── Set Color Label
│   └── Red/Yellow/Green...     [6-9]
```

---

### 👁️ View (Interface)
*Focus: Workspace layout and viewing modes.*

```
View
├── Show/Hide Library           ⌘1
├── Show/Hide Develop           ⌘2
├── Show/Hide Filmstrip         ⌘3
├── ─────────────────────────────
├── Zoom In                     ⌘+
├── Zoom Out                    ⌘-
├── Fit to Window               ⌘0
├── Actual Size                 ⌥⌘0
├── ─────────────────────────────
├── Compare Mode                C
├── Before/After                \
```

---

## Feature Implementation Details

### 1. The "Develop" Menu
Moving adjustment-related actions to a dedicated **Develop** menu reflects industry standards (Lightroom). This allows power users to quickly copy/paste complex edit states without digging through the general Edit menu.

### 2. The "Metadata" Menu
By providing direct shortcuts (0-5 for ratings, P/X for flags), we enable high-speed culling. This menu interacts directly with the `ImageRecord` schema in our SQLite database.

### 3. "File" Operations
The **Export** suite remains in File as it represents the "production" phase of the workflow. We add **Print** support to round out the standard file lifecycle.

---

## Technical Implementation (Electron)

The menu will be implemented using Electron's `Menu.setApplicationMenu()` in the `main` process.

### IPC Channels (Revised)

| Channel | Direction | Target Component |
|---------|-----------|------------------|
| `menu:action` | Main → Renderer | Triggers a generic action in the UI |
| `edit:undo-redo` | Main → Renderer | Navigates the adjustment history stack |
| `dev:sync` | Main → Renderer | Syncs current sliders to selection |
| `meta:update` | Main → Renderer | Updates database with rating/flag |

---

## Open Questions

1. **Shortcuts** — Should we allow users to customize these shortcuts in a later phase?
2. **Context Menus** — Should the right-click menu on the filmstrip mirror the Library/Develop/Metadata menus exactly?

---

## References
- [Apple Human Interface Guidelines: Menus](https://developer.apple.com/design/human-interface-guidelines/components/menus-and-actions/menus/)
- [Adobe Lightroom Keyboard Shortcuts](https://helpx.adobe.com/lightroom-classic/help/keyboard-shortcuts.html)
