export type FileInfo = {
    name: string;
    path: string;
    isDirectory: boolean;
    type: 'image' | 'video' | 'other'; // Simplified for now
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
