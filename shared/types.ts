export type FileInfo = {
    name: string;
    path: string;
    isDirectory: boolean;
    type: 'image' | 'video' | 'other';
    similarity?: number;
};

export type ScanResult = {
    files: FileInfo[];
    folderPath: string;
};

// Light adjustments (Exposure, Contrast, Highlights, Shadows)
export type LightAdjustments = {
    exposure: number;    // -100 to 100, default 0
    contrast: number;    // -100 to 100, default 0
    highlights: number;  // -100 to 100, default 0
    shadows: number;     // -100 to 100, default 0
};

// Color adjustments (Temperature, Tint, Saturation, Vibrance)
export type ColorAdjustments = {
    temperature: number;  // -100 to 100, default 0
    tint: number;         // -100 to 100, default 0
    saturation: number;   // -100 to 100, default 0
    vibrance: number;     // -100 to 100, default 0
};

// All image adjustments (extensible for future Effects, Detail, etc.)
export type ImageAdjustments = {
    light: LightAdjustments;
    color?: ColorAdjustments;  // Optional for now
};

// Track edit state per image for saving
export type ImageEditState = {
    filePath: string;
    adjustments: ImageAdjustments;
    isDirty: boolean;  // true if any edit differs from default
};

// Metadata stored alongside images (sidecar file)
export type ImageMetadata = {
    filePath: string;
    adjustments: ImageAdjustments;
    lastModified: string;  // ISO date
    presetName?: string;   // If derived from preset
};

// Saved style preset
export type StylePreset = {
    id: string;
    name: string;
    adjustments: ImageAdjustments;
    createdAt: string;
};

// Default values
export const DEFAULT_LIGHT_ADJUSTMENTS: LightAdjustments = {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
};

export const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = {
    temperature: 0,
    tint: 0,
    saturation: 0,
    vibrance: 0,
};

export const DEFAULT_IMAGE_ADJUSTMENTS: ImageAdjustments = {
    light: DEFAULT_LIGHT_ADJUSTMENTS,
    color: DEFAULT_COLOR_ADJUSTMENTS,
};

// ============================================
// Library / Smart Organization Types
// ============================================

// Image record from database
export type LibraryImage = {
    id: number;
    file_path: string;
    file_name: string;
    file_hash: string | null;
    file_size: number | null;
    width: number | null;
    height: number | null;
    date_taken: string | null;
    date_imported: string;
    camera_make: string | null;
    camera_model: string | null;
    gps_lat: number | null;
    gps_lng: number | null;
    phash: string | null;
    auto_tags: string | null;
    scene_type: string | null;
    analyzed_at: string | null;
    analysis_version: number;
};

// Group of duplicate images
export type DuplicateGroup = {
    groupId: number;
    images: LibraryImage[];
};

// Library statistics
export type LibraryStats = {
    totalImages: number;
    duplicateGroups: number;
};

// Album record
export type AlbumRecord = {
    id: number;
    name: string;
    description: string | null;
    cover_image_id: number | null;
    created_at: string;
    updated_at: string;
    photo_count?: number;
    cover_path?: string;
};

// Import progress event
export type ImportProgress = {
    phase: 'scanning' | 'analyzing' | 'saving' | 'detecting_duplicates' | 'ai_tagging' | 'complete';
    current: number;
    total: number;
    file: string;
};

// Import result
export type ImportResult = {
    success: boolean;
    imported: number;
    duplicates: number;
    error?: string;
};

// Tag information
export type TagInfo = {
    tag: string;
    count: number;
    category: string | null;
};

// Search result
export type SearchResult = {
    id: number;
    file_path: string;
    similarity: number;
};

// ============================================
// Face Recognition Types (Phase 3)
// ============================================

// Face detection input (from MediaPipe)
export type FaceDetection = {
    bbox: { x: number; y: number; width: number; height: number };
    keypoints?: { x: number; y: number; name: string }[];
    confidence: number;
};

// Face record from database
export type FaceRecord = {
    id: number;
    image_id: number;
    bbox_x: number;
    bbox_y: number;
    bbox_w: number;
    bbox_h: number;
    person_id: number | null;
    person_name?: string;
    confidence: number | null;
    created_at: string;
    file_path?: string;
};

// Person record
export type PersonRecord = {
    id: number;
    name: string;
    face_count: number;
    representative_face_id: number | null;
    is_hidden: boolean;
    created_at: string;
};

// Face cluster (for organizing unidentified faces)
export type FaceCluster = {
    centroidFaceId: number;
    faceIds: number[];
    suggestedName?: string;
};

// Suggested face match
export type SuggestedMatch = {
    personId: number;
    personName: string;
    similarity: number;
};

// Face detection result from processing
export type FaceDetectionResult = {
    faceId: number;
    suggestedMatch: SuggestedMatch | null;
};

// Face statistics
export type FaceStats = {
    totalFaces: number;
    identifiedFaces: number;
    unidentifiedFaces: number;
    totalPeople: number;
};
