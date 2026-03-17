# Maige Tauri Backend

Rust backend for the Maige image editor, built with Tauri 2.

## Architecture

```
src/
├── main.rs           # App entry point, plugin setup
├── commands.rs       # Tauri command handlers (IPC)
├── database.rs       # SQLite operations via rusqlite
└── image_processor.rs # Native image processing
```

## Commands

### Folder Operations
- `open_folder_dialog` - Open native folder picker
- `scan_folder_for_images` - Recursively find image files
- `import_folder` - Analyze and import all images to database

### Image Operations
- `get_image_metadata` - Get dimensions, format, EXIF data
- `generate_phash` - Generate perceptual hash for duplicates
- `process_image` - Apply adjustments, return RGBA buffer
- `get_histogram` - Generate RGB histogram
- `export_image` - Save image with adjustments

### Database Operations
- `init_database` - Create tables
- `get_all_images` - List all images
- `get_image_by_id` - Get single image
- `update_image_adjustments` - Save adjustments
- `search_images` - Text search

### Album Operations
- `create_album` - Create new album
- `get_albums` - List all albums
- `add_to_album` - Add image to album
- `remove_from_album` - Remove image from album

## Development

```bash
# Check compilation
cargo check

# Run in development mode (from project root)
npm run tauri:dev

# Build for production
npm run tauri:build
```

## Configuration

See `tauri.conf.json` for window settings, plugins, and security configuration.

## Plugins

- **tauri-plugin-shell** - Open external URLs
- **tauri-plugin-dialog** - Native file dialogs
- **tauri-plugin-fs** - File system access

## Database Schema

```sql
-- Images table
CREATE TABLE images (
    id INTEGER PRIMARY KEY,
    file_path TEXT UNIQUE,
    file_name TEXT,
    file_size INTEGER,
    file_hash TEXT,
    width INTEGER,
    height INTEGER,
    format TEXT,
    date_taken TEXT,
    camera_make TEXT,
    camera_model TEXT,
    phash TEXT,
    adjustments TEXT,
    created_at TEXT,
    updated_at TEXT
);

-- Albums
CREATE TABLE albums (
    id INTEGER PRIMARY KEY,
    name TEXT,
    created_at TEXT
);

-- Album-Image relationship
CREATE TABLE album_images (
    album_id INTEGER,
    image_id INTEGER,
    added_at TEXT,
    PRIMARY KEY (album_id, image_id)
);
```
