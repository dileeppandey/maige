# Smart Image Organization Feature

**Status:** Proposal  
**Date:** December 25, 2025

## Overview

A feature that allows users to provide a folder and automatically:
1. Find all images recursively (including subfolders)
2. Group similar images together algorithmically
3. Use image recognition to organize images into collections
4. Tag with metadata like person, place, and things
5. Support user-trainable labeling for personalized recognition

---

## Goals

- **Privacy-first**: All processing happens locally on-device
- **Leverage Apple Silicon**: Use Neural Engine for fast ML inference
- **User-trainable**: Learn from user corrections and labels
- **Scalable**: Handle 10,000+ image libraries efficiently

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Electron Main Process                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Image Analysis Pipeline                                         │
│  ├── CLIP Model (General scene/object understanding)            │
│  ├── MediaPipe (Face detection & recognition)                   │
│  ├── Perceptual Hashing (Duplicate detection)                   │
│  └── EXIF Extraction (Date, location, camera)                   │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  SQLite Database                                                 │
│  ├── Image embeddings (512-dim vectors)                         │
│  ├── Face embeddings (per-person clusters)                      │
│  ├── Tags & metadata                                            │
│  └── User corrections & labels                                  │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  React Frontend                                                  │
│  ├── Collections View (auto-generated smart albums)             │
│  ├── People View (faces grouped by person)                      │
│  ├── Tag Browser (filter by tags)                               │
│  └── Search (semantic search across all images)                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Recommended Models

### 1. CLIP (Contrastive Language-Image Pre-training) — Primary

| Aspect | Details |
|--------|---------|
| **What it does** | Understands images + text together |
| **Key benefit** | Zero-shot classification — describe what you want to find without retraining |
| **Size** | ~350MB (ViT-B/32) |
| **Speed on M1** | ~50-100ms per image |
| **User training** | Can fine-tune with user's labeled examples |

### 2. MediaPipe — Face Recognition

| Aspect | Details |
|--------|---------|
| **What it does** | Detects faces and creates embeddings for matching |
| **Key benefit** | Learn "This is John" with just a few labeled photos |
| **User training** | Cluster faces automatically, user names them |

### 3. Perceptual Hashing — Duplicate Detection

| Aspect | Details |
|--------|---------|
| **What it does** | Fast fingerprinting for near-duplicate detection |
| **Key benefit** | Very fast, no ML required |
| **Speed** | ~5ms per image |

---

## Technology Stack

| Purpose | Package | Notes |
|---------|---------|-------|
| CLIP inference | `@xenova/transformers` | Pure JS, works in Node.js |
| Face detection | `@mediapipe/tasks-vision` | Google's highly optimized face detection |
| ONNX Runtime | `onnxruntime-node` | Native, uses Apple Neural Engine |
| Perceptual hash | `imghash` + `sharp` | Fast duplicate detection |
| Database | `better-sqlite3` | Embeddings + metadata storage |
| Vector similarity | `hnswlib-node` | Fast nearest neighbor search |

---

## Output Per Image

```typescript
interface ImageAnalysis {
  filePath: string;
  
  // CLIP embedding for semantic similarity
  embedding: number[];  // 512-dim vector
  
  // Auto-generated tags
  tags: {
    objects: string[];     // ["beach", "sunset", "dog"]
    scene: string;         // "outdoor", "indoor"
    activity?: string;     // "hiking", "party"
  };
  
  // Face data
  faces: {
    embedding: number[];   // Face embedding for matching
    bbox: [x, y, w, h];    // Face bounding box
    personId?: string;     // Linked after user labels
  }[];
  
  // Duplicate detection
  pHash: string;           // Perceptual hash
  
  // EXIF metadata
  exif: {
    dateTaken?: Date;
    location?: { lat: number; lng: number };
    camera?: string;
  };
}
```

---

## Storage Strategy

### Recommended: SQLite Database + Optional Sidecars

```
~/Library/Application Support/maige/
├── library.db              # All metadata, embeddings, collections
├── models/                 # Downloaded ML models (on first run)
│   ├── clip-vit-base/
│   └── face-detection/
└── cache/
    └── thumbnails/         # Cached thumbnails for fast loading
```

| Option | Pros | Cons |
|--------|------|------|
| **SQLite (Recommended)** | Fast queries, single file backup, complex queries | Not portable with images |
| **Sidecar JSON** | Travels with images | Scattered data, slow queries |
| **Hybrid** | Best of both worlds | More complexity |

---

## Database Schema

```sql
-- Core image table
CREATE TABLE images (
    id INTEGER PRIMARY KEY,
    file_path TEXT UNIQUE NOT NULL,
    file_hash TEXT,                    -- SHA256 for detecting changes
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    date_taken DATETIME,
    date_imported DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- EXIF data
    camera_make TEXT,
    camera_model TEXT,
    gps_lat REAL,
    gps_lng REAL,
    
    -- ML outputs (stored as binary for efficiency)
    clip_embedding BLOB,               -- 512 floats as binary
    phash TEXT,                        -- Perceptual hash string
    auto_tags TEXT,                    -- JSON: ["beach", "sunset", "dog"]
    scene_type TEXT,                   -- "outdoor", "indoor", "portrait"
    
    -- Processing status
    analyzed_at DATETIME,
    analysis_version INTEGER           -- Re-process when models update
);

-- Face detections (multiple per image possible)
CREATE TABLE faces (
    id INTEGER PRIMARY KEY,
    image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
    embedding BLOB,                    -- 128-dim face embedding
    bbox_x REAL, bbox_y REAL,          -- Normalized 0-1
    bbox_w REAL, bbox_h REAL,
    person_id INTEGER REFERENCES people(id),
    confidence REAL,
    UNIQUE(image_id, bbox_x, bbox_y)
);

-- Named people (user-labeled)
CREATE TABLE people (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    representative_face_id INTEGER,    -- Best face for avatar
    is_hidden BOOLEAN DEFAULT FALSE    -- User can hide people
);

-- Collections (smart, auto-generated, and user-created)
CREATE TABLE collections (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,                -- "smart" | "user" | "auto"
    icon TEXT,                         -- Emoji or icon name
    query TEXT,                        -- JSON filter for smart collections
    sort_order INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Images in collections (many-to-many)
CREATE TABLE collection_images (
    collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
    image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, image_id)
);

-- User corrections (for improving ML over time)
CREATE TABLE tag_corrections (
    id INTEGER PRIMARY KEY,
    image_id INTEGER REFERENCES images(id),
    tag TEXT NOT NULL,
    action TEXT NOT NULL,              -- "add" | "remove" | "confirm"
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Duplicate groups
CREATE TABLE duplicate_groups (
    id INTEGER PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE duplicate_members (
    group_id INTEGER REFERENCES duplicate_groups(id) ON DELETE CASCADE,
    image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,  -- User's preferred version
    PRIMARY KEY (group_id, image_id)
);

-- Indexes for performance
CREATE INDEX idx_images_date ON images(date_taken);
CREATE INDEX idx_images_phash ON images(phash);
CREATE INDEX idx_faces_person ON faces(person_id);
CREATE INDEX idx_faces_image ON faces(image_id);
```

---

## Organization Output (UI Structure)

### Library Panel (Left Sidebar)

```
┌─────────────────────────────────┐
│  LIBRARY                        │
├─────────────────────────────────┤
│  📁 Folders                     │
│    └─ Vacation 2024 (342)       │
│    └─ Family Photos (1,203)     │
│                                 │
│  ⭐ SMART COLLECTIONS           │
│    └─ 👤 People                 │
│       ├─ John (89)              │
│       ├─ Sarah (156)            │
│       └─ Unknown Faces (23)     │
│    └─ 📍 Places                 │
│       ├─ San Francisco (45)     │
│       ├─ Beach (78)             │
│       └─ Home (234)             │
│    └─ 📅 By Date                │
│       ├─ 2024                   │
│       │   ├─ December (42)      │
│       │   └─ November (89)      │
│       └─ 2023                   │
│    └─ 🏷️ Tags                   │
│       ├─ Sunset (34)            │
│       ├─ Dog (56)               │
│       └─ Birthday (23)          │
│    └─ 🔄 Duplicates (12 groups) │
│                                 │
│  📂 MY COLLECTIONS              │
│    └─ ⭐ Favorites              │
│    └─ 📷 Portfolio              │
│    └─ + New Collection          │
└─────────────────────────────────┘
```

### Grid View (Main Area)

```
┌──────────────────────────────────────────────────────────────┐
│  👤 People > John                             ≡ Grid  Sort ▼ │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  December 2024                                               │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                    │
│  │ 📷  │ │ 📷  │ │ 📷  │ │ 📷  │ │ 📷  │                    │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                    │
│                                                              │
│  November 2024                                               │
│  ┌─────┐ ┌─────┐ ┌─────┐                                    │
│  │ 📷  │ │ 📷  │ │ 📷  │       89 photos with John          │
│  └─────┘ └─────┘ └─────┘                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Metadata Panel (Right Sidebar)

```
┌─────────────────────────────────┐
│  INFO                           │
├─────────────────────────────────┤
│  📅 Dec 24, 2024 at 3:45 PM     │
│  📷 iPhone 15 Pro               │
│  📐 4032 × 3024 (12.2 MP)       │
│  📍 San Francisco, CA           │
│                                 │
├─────────────────────────────────┤
│  🏷️ TAGS                        │
│  ┌────────┐ ┌────────┐          │
│  │outdoor │ │ beach  │          │
│  └────────┘ └────────┘          │
│  ┌────────┐ ┌────────┐          │
│  │ sunset │ │ + add  │          │
│  └────────┘ └────────┘          │
│                                 │
├─────────────────────────────────┤
│  👤 PEOPLE IN PHOTO             │
│  ┌───┐ ┌───┐                    │
│  │ J │ │ S │  + Name a face     │
│  │ohn│ │ara│                    │
│  └───┘ └───┘                    │
│                                 │
├─────────────────────────────────┤
│  📁 COLLECTIONS                 │
│  • Vacation 2024                │
│  • Favorites                    │
│  + Add to collection...         │
└─────────────────────────────────┘
```

---

## Query Examples

```typescript
// Find all photos of John at the beach
const query = `
  SELECT i.* FROM images i
  JOIN faces f ON f.image_id = i.id
  JOIN people p ON f.person_id = p.id
  WHERE p.name = 'John'
  AND i.auto_tags LIKE '%beach%'
  ORDER BY i.date_taken DESC
`;

// Find potential duplicates
const duplicates = `
  SELECT * FROM images 
  WHERE phash IN (
    SELECT phash FROM images 
    GROUP BY phash HAVING COUNT(*) > 1
  )
`;

// Semantic search using CLIP (in app code)
async function semanticSearch(query: string, limit = 20) {
  const queryEmbedding = await clipModel.encode(query);
  // Use hnswlib for fast nearest neighbor
  const results = await vectorIndex.search(queryEmbedding, limit);
  return results.map(r => getImageById(r.id));
}
```

---

## Smart Collections (Auto-Generated)

- **People**: Grouped by face clusters (user can name them)
- **Places**: Grouped by GPS location
- **Duplicates**: Near-identical images
- **By Date**: Year/month groupings
- **Scenes**: Beach, Mountain, City, Indoor, etc.
- **Events**: Clusters of photos from same time/place

---

## User Training Flow

1. **Face Recognition**
   - System clusters faces automatically
   - User clicks on a face cluster → "Name this person"
   - All photos with that face get tagged

2. **Custom Labels**
   - User can drag images into custom collections
   - System learns from these groupings
   - Suggests similar images for the collection

3. **Corrections**
   - User can remove incorrect tags
   - System uses negative examples to improve

---

## Performance Considerations

- **Parallel Processing**: Use `worker_threads` with all CPU cores
- **Batch Processing**: Process images in batches for efficiency
- **Caching**: Cache embeddings to avoid re-processing
- **Progressive Loading**: Show results as they're computed
- **Background Processing**: Non-blocking import for large folders

### Expected Performance (Apple Silicon)

| Operation | Speed |
|-----------|-------|
| CLIP embedding | 50-100ms/image |
| Face detection | 30-50ms/image |
| Perceptual hash | 5-10ms/image |
| **Total pipeline** | ~100-200ms/image |
| **10,000 images** | ~20-30 minutes |

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Recursive folder scanning
- [ ] Perceptual hashing for duplicate detection
- [ ] SQLite database setup
- [ ] Basic UI for collections

### Phase 2: Smart Tagging
- [ ] CLIP model integration
- [ ] Auto-tagging pipeline
- [ ] Tag browser UI
- [ ] Semantic search

### Phase 3: Face Recognition
- [ ] Face detection integration
- [ ] Face clustering algorithm
- [ ] People view UI
- [ ] User labeling flow

### Phase 4: Polish
- [ ] Background processing
- [ ] Progress indicators
- [ ] Performance optimization
- [ ] User training/correction flows

---

## Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **ML Runtime** | Transformers.js | Simple setup, HuggingFace ecosystem, good enough perf |
| **Database** | Global Library (SQLite) | Fast cross-folder search, single backup point |
| **Training Export** | JSON sidecar (labels only) | User owns data, privacy-safe |
| **Privacy UI** | Multi-touch approach | Onboarding + settings + indicators |

---

## Technical Decisions (With Analysis)

### 1. Transformers.js vs ONNX Runtime

| Aspect | Transformers.js | ONNX Runtime |
|--------|-----------------|--------------|
| **Setup** | `npm install` — works immediately | Native binaries, platform-specific |
| **Model Support** | 1000s of HuggingFace models | Need ONNX-converted models |
| **Performance** | WASM-based, ~2-5x slower | Native, uses Apple Neural Engine |
| **Speed (CLIP)** | ~200-400ms/image | ~50-100ms/image |
| **Memory** | Higher (JS + WASM overhead) | Lower (native memory) |
| **Bundling** | Easy, pure JS | Complex native deps |
| **Electron** | ✅ Excellent | ⚠️ Careful setup needed |

**Recommendation:** Start with **Transformers.js** for MVP (fast to implement), migrate to ONNX Runtime later if performance is insufficient.

---

### 2. Database Location

| Option | Pros | Cons |
|--------|------|------|
| **Global Library** (`~/Library/Application Support/`) | Single source of truth, fast search across all photos, easy backup | Can't have multiple workspaces, tied to one machine |
| **Per-Project** (`.maige/` in folder) | Portable, metadata travels with images, multiple workspaces | Scattered data, can't search across projects, duplicated embeddings |
| **Hybrid** | Best of both | More complexity |

**Recommendation:** **Global Library** with optional "Export metadata" feature for portability.

---

### 3. Training Data Export

| Option | Pros | Cons |
|--------|------|------|
| **Yes, export** | User owns their data, can migrate to new machine, backup face labels | Privacy risk if exported, larger file sizes |
| **No export** | Simpler, no privacy concerns | User loses training on machine change |

**Recommendation:** Allow export of **user labels and face clusters** (what user trained), but NOT the raw embeddings. Format: JSON sidecar.

---

### 4. Privacy Communication

| Approach | Implementation |
|----------|----------------|
| **Onboarding modal** | "All your photos are analyzed locally. Nothing leaves your device." |
| **Settings page** | Privacy section explaining local-only processing |
| **Processing indicator** | "Analyzing locally..." with local icon |
| **No cloud icons** | Avoid cloud imagery, use device/chip icons |

**Recommendation:** All of the above. Privacy is a key differentiator from Google Photos/iCloud.

---

## References

- [CLIP by OpenAI](https://openai.com/research/clip)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [MediaPipe](https://developers.google.com/mediapipe)
- [ONNX Runtime](https://onnxruntime.ai/)
