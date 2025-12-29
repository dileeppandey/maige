# Feature Proposal: Albums & Bulk Metadata Management

## 1. Objective
Enable users to organize photos into custom **Albums** and efficiently manage metadata (tags, descriptions, people) across multiple images simultaneously.

## 2. User Experience

### A. Global Multi-Selection
- **Selection Mode**: CMD/CTRL + Click or Shift + Click images in the filmstrip or grid to enter selection mode.
- **Floating Action Bar**: When 1+ images are selected, a premium floating bar appears at the bottom of the screen (similar to Lightroom/Google Photos).
    - **Actions**: `Add Tag`, `Add to Album`, `Set Date`, `Delete`, `Clear Selection`.

### B. Album Management
- **Library Sidebar**: A new "Albums" section in the `LibraryPanel` with a `+` icon.
- **CRUD Operations**:
    - Right-click album to `Rename` or `Delete`.
    - Drag & Drop photos from the filmstrip into an album sidebar entry.
- **Smart Albums (Optional Future)**: Albums based on rules (e.g., "Photos from 2023 with 'beach' tag").

### C. Bulk Tagging & Info
- Open a **Multi-Edit Inspector** when multiple files are selected.
- Typing a tag in the bulk inspector adds it to all selected images without overwriting existing unique tags.

## 3. Technical Implementation

### A. Database Schema
New tables to support manual organization:

```sql
-- Albums metadata
CREATE TABLE albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    cover_image_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cover_image_id) REFERENCES images(id) ON DELETE SET NULL
);

-- Mapping images to albums
CREATE TABLE album_items (
    album_id INTEGER,
    image_id INTEGER,
    position INTEGER, -- For custom ordering
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (album_id, image_id),
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);
```

### B. IPC API
New endpoints for Electron:
- `albums:create(name)`
- `albums:list()`
- `albums:addPhotos(albumId, imageIds[])`
- `albums:removePhotos(albumId, imageIds[])`
- `albums:delete(albumId)`
- `library:updateMetadata(imageIds[], metadata)`

### C. State Management
Update `useLibraryStore` to track `selectedImageIds: Set<number>`.

## 4. UI Design Aesthetic
- **Floating Bar**: Glassmorphism effect (blur + semi-transparent) with subtle entrance animation.
- **Album Grid**: Modern masonry or squared grid with a "Stack" visual effect for album covers.
- **Micro-interactions**: Scale-up effect when dragging photos over an album.
