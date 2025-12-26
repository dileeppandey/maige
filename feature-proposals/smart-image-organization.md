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
│  ├── InsightFace (Face detection & recognition)                 │
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

### 2. InsightFace — Face Recognition

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
| Face detection | `@vladmandic/face-api` | Node.js face detection/recognition |
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

## Open Questions

1. **Transformers.js vs ONNX Runtime** — Simpler setup vs faster inference?
2. **Database location** — Per-project or global library?
3. **Training data export** — Should users be able to export their trained models?
4. **Privacy UI** — How to communicate that everything is local?

---

## References

- [CLIP by OpenAI](https://openai.com/research/clip)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [InsightFace](https://insightface.ai/)
- [ONNX Runtime](https://onnxruntime.ai/)
