/**
 * Tauri API Bridge
 *
 * Provides window.api backed by Tauri commands,
 * allowing the frontend to call into the Tauri backend uniformly.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { FaceRecord } from '../shared/types';

// Types (match Rust snake_case serialization)
interface LibraryImage {
    id: number;
    file_path: string;
    file_name: string;
    width: number;
    height: number;
    format: string;
    date_taken?: string;
    camera_make?: string;
    camera_model?: string;
    phash?: string;
}

interface Album {
    id: number;
    name: string;
    description?: string;
    created_at: string;
}

interface Person {
    id: number;
    name: string;
    face_count: number;
}

interface Stats {
    totalImages: number;
    duplicateGroups: number;
}

// Imported from shared/types — kept local for bridge use
interface FaceCluster {
    centroid_face_id: number;
    face_ids: number[];
}

const apiImpl = {
    // ================== Folder Operations ==================

    selectFolder: async (): Promise<string | null> => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
            });
            return selected as string | null;
        } catch (e) {
            console.error('selectFolder error:', e);
            return null;
        }
    },

    readFolder: async (path: string): Promise<string[]> => {
        try {
            return await invoke<string[]>('scan_folder_for_images', { folderPath: path });
        } catch (e) {
            console.error('readFolder error:', e);
            return [];
        }
    },

    importFolder: async (path: string): Promise<{ success: boolean; imported: number; duplicates: number }> => {
        try {
            const images = await invoke<LibraryImage[]>('import_folder', { folderPath: path });
            return { success: true, imported: images.length, duplicates: 0 };
        } catch (e) {
            console.error('importFolder error:', e);
            return { success: false, imported: 0, duplicates: 0 };
        }
    },

    // ================== Library Operations ==================

    getLibraryImages: async (_options?: { limit?: number; offset?: number }): Promise<LibraryImage[]> => {
        try {
            return await invoke<LibraryImage[]>('get_all_images');
        } catch (e) {
            console.error('getLibraryImages error:', e);
            return [];
        }
    },

    getStats: async (): Promise<Stats> => {
        try {
            const images = await invoke<LibraryImage[]>('get_all_images');
            return {
                totalImages: images.length,
                duplicateGroups: 0,
            };
        } catch (e) {
            console.error('getStats error:', e);
            return { totalImages: 0, duplicateGroups: 0 };
        }
    },

    getDuplicates: async (): Promise<string[][]> => {
        try {
            return await invoke<string[][]>('get_duplicates');
        } catch (e) {
            console.error('getDuplicates error:', e);
            return [];
        }
    },

    getTags: async (): Promise<string[]> => {
        try {
            const tags = await invoke<{ tag: string }[]>('get_tags');
            return tags.map(t => t.tag);
        } catch (e) {
            console.error('getTags error:', e);
            return [];
        }
    },

    search: async (query: string): Promise<LibraryImage[]> => {
        try {
            return await invoke<LibraryImage[]>('search_images', { query });
        } catch (e) {
            console.error('search error:', e);
            return [];
        }
    },

    getImagesByTag: async (tagName: string, _options?: { limit?: number; offset?: number }): Promise<LibraryImage[]> => {
        try {
            return await invoke<LibraryImage[]>('get_images_by_tag', { tagName });
        } catch (e) {
            console.error('getImagesByTag error:', e);
            return [];
        }
    },

    deleteImages: async (imageIds: number[], _permanent: boolean): Promise<{ deleted: number[]; failed: number[] }> => {
        try {
            await invoke('delete_images', { ids: imageIds });
            return { deleted: imageIds, failed: [] };
        } catch (e) {
            console.error('deleteImages error:', e);
            return { deleted: [], failed: imageIds };
        }
    },

    // ================== Album Operations ==================

    getAlbums: async (): Promise<Album[]> => {
        try {
            return await invoke<Album[]>('get_albums');
        } catch (e) {
            console.error('getAlbums error:', e);
            return [];
        }
    },

    createAlbum: async (name: string, description?: string): Promise<Album> => {
        try {
            return await invoke<Album>('create_album', { name });
        } catch (e) {
            console.error('createAlbum error:', e);
            return { id: 0, name, description: description || '', created_at: new Date().toISOString() };
        }
    },

    deleteAlbum: async (albumId: number): Promise<void> => {
        try {
            await invoke('delete_album', { albumId });
        } catch (e) {
            console.error('deleteAlbum error:', e);
        }
    },

    updateAlbum: async (albumId: number, data: { name?: string; description?: string }): Promise<void> => {
        try {
            await invoke('update_album', { albumId, name: data.name ?? null, description: data.description ?? null });
        } catch (e) {
            console.error('updateAlbum error:', e);
        }
    },

    getAlbumImages: async (albumId: number): Promise<LibraryImage[]> => {
        try {
            return await invoke<LibraryImage[]>('get_album_images', { albumId });
        } catch (e) {
            console.error('getAlbumImages error:', e);
            return [];
        }
    },

    addPhotosToAlbum: async (albumId: number, imageIds: number[]): Promise<void> => {
        try {
            for (const imageId of imageIds) {
                await invoke('add_to_album', { albumId, imageId });
            }
        } catch (e) {
            console.error('addPhotosToAlbum error:', e);
        }
    },

    removePhotosFromAlbum: async (albumId: number, imageIds: number[]): Promise<void> => {
        try {
            for (const imageId of imageIds) {
                await invoke('remove_from_album', { albumId, imageId });
            }
        } catch (e) {
            console.error('removePhotosFromAlbum error:', e);
        }
    },

    // ================== People/Face Operations ==================
    // Note: Face detection stays on frontend (MediaPipe), storage is in Tauri backend

    getAllPeople: async (): Promise<Person[]> => {
        try {
            return await invoke<Person[]>('get_all_people');
        } catch (e) {
            console.error('getAllPeople error:', e);
            return [];
        }
    },

    getImagesByPerson: async (personId: number): Promise<LibraryImage[]> => {
        try {
            return await invoke<LibraryImage[]>('get_images_by_person', { personId });
        } catch (e) {
            console.error('getImagesByPerson error:', e);
            return [];
        }
    },

    getFaceInfo: async (faceId: string): Promise<{ person_id?: number; person_name?: string; image_path: string } | null> => {
        try {
            const face = await invoke<{ person_id?: number; person_name?: string; image_path: string } | null>('get_face_info', { faceId: Number(faceId) });
            return face;
        } catch (e) {
            console.error('getFaceInfo error:', e);
            return null;
        }
    },

    getFaceThumbnail: async (faceId: string): Promise<string | null> => {
        try {
            return await invoke<string | null>('get_face_thumbnail', { faceId: Number(faceId) });
        } catch (e) {
            console.error('getFaceThumbnail error:', e);
            return null;
        }
    },

    getUnidentifiedFaces: async (): Promise<Array<{ id: string; image_path: string }>> => {
        try {
            const faces = await invoke<Array<{ id: number; image_path: string }>>('get_unidentified_faces');
            return faces.map(f => ({ id: String(f.id), image_path: f.image_path }));
        } catch (e) {
            console.error('getUnidentifiedFaces error:', e);
            return [];
        }
    },

    getFaceStats: async (): Promise<{ totalFaces: number; identifiedFaces: number; unidentifiedFaces: number; totalPeople: number }> => {
        try {
            const raw = await invoke<{ total_faces: number; identified_faces: number; unidentified_faces: number; total_people: number }>('get_face_stats');
            return { totalFaces: raw.total_faces, identifiedFaces: raw.identified_faces, unidentifiedFaces: raw.unidentified_faces, totalPeople: raw.total_people };
        } catch (e) {
            console.error('getFaceStats error:', e);
            return { totalFaces: 0, identifiedFaces: 0, unidentifiedFaces: 0, totalPeople: 0 };
        }
    },

    getHiddenPeople: async (): Promise<Person[]> => {
        try {
            return await invoke<Person[]>('get_hidden_people');
        } catch (e) {
            console.error('getHiddenPeople error:', e);
            return [];
        }
    },

    clusterFaces: async (): Promise<FaceCluster[]> => {
        try {
            return await invoke<FaceCluster[]>('cluster_faces');
        } catch (e) {
            console.error('clusterFaces error:', e);
            return [];
        }
    },

    detectAndEmbedFaces: async (imageId: number, imagePath: string): Promise<FaceRecord[]> => {
        try {
            return await invoke<FaceRecord[]>('detect_and_embed_faces', { imageId, imagePath });
        } catch (e) {
            console.error('detectAndEmbedFaces error:', e);
            return [];
        }
    },

    checkModelsStatus: async (): Promise<{ detector: boolean; embedder: boolean; models_dir: string }> => {
        return invoke('check_models_status');
    },

    reloadFaceModels: async (): Promise<{ detector: boolean; embedder: boolean; models_dir: string }> => {
        return invoke('reload_face_models');
    },

    resetFaceData: async (): Promise<void> => {
        try {
            await invoke('reset_face_data');
        } catch (e) {
            console.error('resetFaceData error:', e);
            throw e;
        }
    },

    createPersonFromFace: async (faceId: string, name: string): Promise<Person> => {
        try {
            return await invoke<Person>('create_person_from_face', { faceId: Number(faceId), name });
        } catch (e) {
            console.error('createPersonFromFace error:', e);
            return { id: 0, name, face_count: 1 };
        }
    },

    createPersonFromCluster: async (faceIds: string[], name: string): Promise<Person> => {
        try {
            return await invoke<Person>('create_person_from_cluster', { faceIds: faceIds.map(Number), name });
        } catch (e) {
            console.error('createPersonFromCluster error:', e);
            return { id: 0, name, face_count: faceIds.length };
        }
    },

    setPersonHidden: async (personId: number, hidden: boolean): Promise<void> => {
        try {
            await invoke('set_person_hidden', { personId, hidden });
        } catch (e) {
            console.error('setPersonHidden error:', e);
        }
    },

    assignFaceToPerson: async (faceId: string, personId: number): Promise<void> => {
        try {
            await invoke('assign_face_to_person', { faceId: Number(faceId), personId });
        } catch (e) {
            console.error('assignFaceToPerson error:', e);
        }
    },

    saveFaceDetections: async (imageId: number, imagePath: string, detections: unknown[]): Promise<unknown[]> => {
        try {
            return await invoke<unknown[]>('save_face_detections', { imageId, imagePath, detections });
        } catch (e) {
            console.error('saveFaceDetections error:', e);
            return [];
        }
    },

    // ================== Image Operations ==================

    getImageTagsByPath: async (imagePath: string): Promise<string[]> => {
        try {
            const tags = await invoke<{ tag: string }[]>('get_image_tags_by_path', { filePath: imagePath });
            return tags.map(t => t.tag);
        } catch (e) {
            console.error('getImageTagsByPath error:', e);
            return [];
        }
    },

    getHistogram: async (filePath: string, adjustments: unknown): Promise<{ r: number[]; g: number[]; b: number[]; lum: number[] } | null> => {
        try {
            return await invoke<{ r: number[]; g: number[]; b: number[]; lum: number[] }>('get_histogram', {
                path: filePath,
                adjustments,
            });
        } catch (e) {
            console.error('getHistogram error:', e);
            return null;
        }
    },

    // ================== Export Operations ==================

    showExportSaveDialog: async (defaultPath: string, format: string): Promise<string | null> => {
        try {
            const result = await save({
                defaultPath,
                filters: [{
                    name: format.toUpperCase(),
                    extensions: [format.toLowerCase()],
                }],
            });
            return result;
        } catch (e) {
            console.error('showExportSaveDialog error:', e);
            return null;
        }
    },

    exportImage: async (options: { sourcePath: string; outputPath: string; adjustments: { light: object; color: object }; format: string; quality: number }): Promise<{ success: boolean; path?: string; error?: string }> => {
        try {
            await invoke('export_image', {
                sourcePath: options.sourcePath,
                outputPath: options.outputPath,
                adjustments: options.adjustments,
                format: options.format,
                quality: options.quality,
            });
            return { success: true, path: options.outputPath };
        } catch (e) {
            console.error('exportImage error:', e);
            return { success: false, error: String(e) };
        }
    },

    // ================== Preset Operations ==================

    savePresets: async (presets: unknown[]): Promise<void> => {
        try {
            await invoke('save_presets', { presets });
        } catch (e) {
            console.error('savePresets error:', e);
        }
    },

    loadPresets: async (): Promise<unknown[]> => {
        try {
            return await invoke<unknown[]>('load_presets');
        } catch (e) {
            console.error('loadPresets error:', e);
            return [];
        }
    },

    // ================== Settings ==================

    getSettings: async (): Promise<Record<string, string>> => {
        try {
            return await invoke<Record<string, string>>('get_settings');
        } catch (e) {
            console.error('getSettings error:', e);
            return {};
        }
    },

    saveSetting: async (key: string, value: string): Promise<void> => {
        try {
            await invoke('save_setting', { key, value });
        } catch (e) {
            console.error('saveSetting error:', e);
        }
    },

    // ================== Event Listeners ==================

    onMenuAction: (callback: (action: string, data?: unknown) => void) => {
        let unlisten: (() => void) | null = null;

        listen<{ action: string; data?: unknown }>('menu-action', (event) => {
            callback(event.payload.action, event.payload.data);
        }).then((fn) => {
            unlisten = fn;
        });

        return () => {
            if (unlisten) unlisten();
        };
    },

    onImportProgress: (callback: (progress: { current: number; total: number; file: string }) => void) => {
        let unlisten: (() => void) | null = null;

        listen<{ current: number; total: number; file: string }>('import-progress', (event) => {
            callback(event.payload);
        }).then((fn) => {
            unlisten = fn;
        });

        return () => {
            if (unlisten) unlisten();
        };
    },

    onFaceDetectionPending: (callback: (data: { images: Array<{ id: number; file_path: string }> }) => void) => {
        let unlisten: (() => void) | null = null;
        listen<{ images: Array<{ id: number; file_path: string }> }>('face-detection-pending', (event) => {
            callback(event.payload);
        }).then((fn) => { unlisten = fn; });
        return () => { if (unlisten) unlisten(); };
    },

    // -------------------------------------------------------------------------
    // AI Chat (Ollama / Gemma3:4b)
    // -------------------------------------------------------------------------

    checkOllamaStatus: (): Promise<boolean> =>
        invoke<boolean>('check_ollama_status').catch(() => false),

    analyzeImageScene: (
        imagePath: string,
        region?: { x: number; y: number; width: number; height: number },
    ) =>
        invoke<{ message: string; adjustments: unknown; suggestions: unknown[] }>(
            'analyze_image_scene',
            { imagePath, region: region ?? null },
        ).catch(() => ({
            message: 'AI assistant unavailable — is Ollama running with gemma3:4b?',
            adjustments: null,
            suggestions: [],
        })),

    chatEditImage: (
        imagePath: string,
        instruction: string,
        currentAdjustments: {
            exposure: number; contrast: number; highlights: number; shadows: number;
            whites: number; blacks: number; temperature: number; tint: number;
            saturation: number; vibrance: number;
        },
        regionBase64?: string,
    ) =>
        invoke<{ message: string; adjustments: unknown; suggestions: unknown[] }>(
            'chat_edit_image',
            { imagePath, instruction, currentAdjustments, regionBase64: regionBase64 ?? null },
        ).catch(() => ({
            message: 'AI assistant unavailable — is Ollama running with gemma3:4b?',
            adjustments: null,
            suggestions: [],
        })),

    saveChatMessage: (msg: {
        id: string;
        imagePath: string;
        role: string;
        content: string;
        adjustments?: string | null;
        suggestions?: string | null;
        regionBase64?: string | null;
        timestamp: string;
    }) =>
        invoke<void>('save_chat_message', {
            id: msg.id,
            imagePath: msg.imagePath,
            role: msg.role,
            content: msg.content,
            adjustments: msg.adjustments ?? null,
            suggestions: msg.suggestions ?? null,
            regionBase64: msg.regionBase64 ?? null,
            timestamp: msg.timestamp,
        }).catch(() => {}),

    getChatMessages: (imagePath: string) =>
        invoke<Array<{
            id: string;
            image_path: string;
            role: string;
            content: string;
            adjustments: string | null;
            suggestions: string | null;
            region_base64: string | null;
            timestamp: string;
        }>>('get_chat_messages', { imagePath }).catch(() => []),
};

// Assign to window
(window as unknown as { api: typeof apiImpl }).api = apiImpl;

export { };
