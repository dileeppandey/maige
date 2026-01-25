/**
 * Tauri API Layer
 * 
 * This module provides a unified interface to Tauri's invoke API,
 * replacing Electron's ipcRenderer. Falls back to Electron if Tauri is not available.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

// Extend Window interface for Electron compatibility
declare global {
    interface Window {
        electron?: {
            dialog: {
                openDirectory: () => Promise<string | undefined>;
            };
            scanFolder: (path: string) => Promise<string[]>;
            getImageMetadata: (path: string) => Promise<ImageMetadata>;
            generatePhash: (path: string) => Promise<string>;
            getAllImages: () => Promise<DbImage[]>;
            getImageById: (id: number) => Promise<DbImage | null>;
            searchImages: (query: string) => Promise<DbImage[]>;
            createAlbum: (name: string) => Promise<Album>;
            getAlbums: () => Promise<Album[]>;
            addToAlbum: (albumId: number, imageId: number) => Promise<void>;
            removeFromAlbum: (albumId: number, imageId: number) => Promise<void>;
        };
    }
}

// Type definitions matching the Rust structs
export interface LightAdjustments {
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    whites: number;
    blacks: number;
}

export interface ColorAdjustments {
    temperature: number;
    tint: number;
    saturation: number;
    vibrance: number;
}

export interface Adjustments {
    light: LightAdjustments;
    color: ColorAdjustments;
}

export interface ImageMetadata {
    width: number;
    height: number;
    format: string;
    colorSpace?: string;
    hasAlpha?: boolean;
    dateTaken?: string;
    cameraMake?: string;
    cameraModel?: string;
    focalLength?: number;
    aperture?: number;
    iso?: number;
    shutterSpeed?: string;
}

export interface DbImage {
    id: number;
    filePath: string;
    fileName: string;
    fileSize: number;
    fileHash: string;
    width: number;
    height: number;
    format: string;
    dateTaken?: string;
    cameraMake?: string;
    cameraModel?: string;
    phash: string;
    adjustments?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Album {
    id: number;
    name: string;
    createdAt: string;
}

export interface Histogram {
    r: number[];
    g: number[];
    b: number[];
    lum: number[];
}

// Check if we're running in Tauri
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

// ============================================================================
// Folder Operations
// ============================================================================

/**
 * Open a folder selection dialog
 */
export async function openFolderDialog(): Promise<string | null> {
    if (!isTauri) {
        // Fallback to Electron
        const result = await window.electron?.dialog.openDirectory();
        return result || null;
    }

    const result = await open({
        directory: true,
        multiple: false,
    });
    return result as string | null;
}

/**
 * Scan a folder for image files
 */
export async function scanFolderForImages(folderPath: string): Promise<string[]> {
    if (!isTauri) {
        return window.electron?.scanFolder(folderPath) || [];
    }

    return invoke<string[]>('scan_folder_for_images', { folderPath });
}

/**
 * Import a folder: analyze and store all images
 */
export async function importFolder(
    folderPath: string,
    onProgress?: (current: number, total: number, file: string) => void
): Promise<DbImage[]> {
    if (!isTauri) {
        // Fallback to Electron - this would need the existing ipcRenderer
        console.warn('importFolder: Electron fallback not implemented');
        return [];
    }

    // Listen for progress events
    type ProgressEvent = { current: number; total: number; file: string };
    const unlisten = onProgress
        ? await listen<ProgressEvent>('import-progress', (event) => {
            onProgress(event.payload.current, event.payload.total, event.payload.file);
        })
        : null;

    try {
        const result = await invoke<DbImage[]>('import_folder', { folderPath });
        return result;
    } finally {
        unlisten?.();
    }
}

// ============================================================================
// Image Operations
// ============================================================================

/**
 * Get metadata for an image
 */
export async function getImageMetadata(path: string): Promise<ImageMetadata> {
    if (!isTauri) {
        const result = await window.electron?.getImageMetadata(path);
        if (!result) throw new Error('Failed to get metadata');
        return result;
    }

    return invoke<ImageMetadata>('get_image_metadata', { path });
}

/**
 * Generate perceptual hash for an image
 */
export async function generatePhash(path: string): Promise<string> {
    if (!isTauri) {
        return window.electron?.generatePhash(path) || '';
    }

    return invoke<string>('generate_phash', { path });
}

/**
 * Process an image with adjustments
 */
export async function processImage(
    path: string,
    adjustments: Adjustments
): Promise<Uint8Array> {
    if (!isTauri) {
        // Electron fallback
        console.warn('processImage: Electron fallback not implemented');
        return new Uint8Array();
    }

    const result = await invoke<number[]>('process_image', { path, adjustments });
    return new Uint8Array(result);
}

/**
 * Get histogram for an image
 */
export async function getHistogram(
    path: string,
    adjustments: Adjustments
): Promise<Histogram> {
    if (!isTauri) {
        console.warn('getHistogram: Electron fallback not implemented');
        return { r: [], g: [], b: [], lum: [] };
    }

    return invoke<Histogram>('get_histogram', { path, adjustments });
}

/**
 * Export an image with adjustments
 */
export async function exportImage(
    sourcePath: string,
    outputPath: string,
    adjustments: Adjustments,
    format: string,
    quality: number
): Promise<void> {
    if (!isTauri) {
        console.warn('exportImage: Electron fallback not implemented');
        return;
    }

    await invoke('export_image', { sourcePath, outputPath, adjustments, format, quality });
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Initialize the database
 */
export async function initDatabase(): Promise<void> {
    if (!isTauri) return;

    await invoke('init_database');
}

/**
 * Get all images from the database
 */
export async function getAllImages(): Promise<DbImage[]> {
    if (!isTauri) {
        return window.electron?.getAllImages() || [];
    }

    return invoke<DbImage[]>('get_all_images');
}

/**
 * Get a single image by ID
 */
export async function getImageById(id: number): Promise<DbImage | null> {
    if (!isTauri) {
        return window.electron?.getImageById(id) || null;
    }

    return invoke<DbImage | null>('get_image_by_id', { id });
}

/**
 * Update image adjustments
 */
export async function updateImageAdjustments(
    id: number,
    adjustments: Adjustments
): Promise<void> {
    if (!isTauri) {
        console.warn('updateImageAdjustments: Electron fallback not implemented');
        return;
    }

    await invoke('update_image_adjustments', { id, adjustments });
}

/**
 * Search images by query
 */
export async function searchImages(query: string): Promise<DbImage[]> {
    if (!isTauri) {
        return window.electron?.searchImages(query) || [];
    }

    return invoke<DbImage[]>('search_images', { query });
}

// ============================================================================
// Album Operations
// ============================================================================

/**
 * Create a new album
 */
export async function createAlbum(name: string): Promise<Album> {
    if (!isTauri) {
        const result = await window.electron?.createAlbum(name);
        if (!result) throw new Error('Failed to create album');
        return result;
    }

    return invoke<Album>('create_album', { name });
}

/**
 * Get all albums
 */
export async function getAlbums(): Promise<Album[]> {
    if (!isTauri) {
        return window.electron?.getAlbums() || [];
    }

    return invoke<Album[]>('get_albums');
}

/**
 * Add image to album
 */
export async function addToAlbum(albumId: number, imageId: number): Promise<void> {
    if (!isTauri) {
        return window.electron?.addToAlbum(albumId, imageId);
    }

    await invoke('add_to_album', { albumId, imageId });
}

/**
 * Remove image from album
 */
export async function removeFromAlbum(albumId: number, imageId: number): Promise<void> {
    if (!isTauri) {
        return window.electron?.removeFromAlbum(albumId, imageId);
    }

    await invoke('remove_from_album', { albumId, imageId });
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if running in Tauri
 */
export function isTauriApp(): boolean {
    return isTauri;
}

/**
 * Get the default adjustments
 */
export function getDefaultAdjustments(): Adjustments {
    return {
        light: {
            exposure: 0,
            contrast: 0,
            highlights: 0,
            shadows: 0,
            whites: 0,
            blacks: 0,
        },
        color: {
            temperature: 0,
            tint: 0,
            saturation: 0,
            vibrance: 0,
        },
    };
}

/**
 * Emit an event to the backend
 */
export async function emitEvent(eventName: string, payload?: unknown): Promise<void> {
    if (!isTauri) return;
    await emit(eventName, payload);
}

/**
 * Listen for events from the backend
 */
export async function listenToEvent<T>(
    eventName: string,
    handler: (payload: T) => void
): Promise<() => void> {
    if (!isTauri) {
        return () => { };
    }

    const unlisten = await listen<T>(eventName, (event) => {
        handler(event.payload);
    });

    return unlisten;
}
