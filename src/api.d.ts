import { FileInfo, LibraryImage, DuplicateGroup, LibraryStats, ImportProgress, ImportResult, TagInfo, SearchResult, FaceRecord, PersonRecord, FaceCluster, FaceDetection, FaceDetectionResult, FaceStats, AlbumRecord, ImageRecord } from '../shared/types';

export { };

declare global {
    interface Window {
        electronAPI: {
            selectFolder: () => Promise<string | null>;
            readFolder: (path: string) => Promise<FileInfo[]>;

            // Library operations
            importFolder: (path: string) => Promise<ImportResult>;
            getLibraryImages: (options?: { limit?: number; offset?: number }) => Promise<LibraryImage[]>;
            getDuplicates: () => Promise<DuplicateGroup[]>;
            getStats: () => Promise<LibraryStats>;
            deleteImages: (imageIds: number[], deleteFromDisk?: boolean) => Promise<{
                success: boolean;
                deletedFromDb?: number;
                deletedFromDisk?: number;
                error?: string;
            }>;
            onImportProgress: (callback: (progress: ImportProgress) => void) => () => void;

            // Tags and search
            getTags: () => Promise<TagInfo[]>;
            getImagesByTag: (tag: string, options?: { limit?: number; offset?: number }) => Promise<LibraryImage[]>;
            getImageTagsByPath: (filePath: string) => Promise<{ tag: string; score: number; category: string | null }[]>;
            getImageByPath: (filePath: string) => Promise<ImageRecord | null>;
            search: (query: string) => Promise<SearchResult[]>;

            // Face operations
            saveFaceDetections: (imageId: number, imagePath: string, detections: FaceDetection[]) => Promise<FaceDetectionResult[]>;
            getFacesForImage: (imageId: number) => Promise<FaceRecord[]>;
            getUnidentifiedFaces: () => Promise<FaceRecord[]>;
            clusterFaces: () => Promise<FaceCluster[]>;
            getFaceStats: () => Promise<FaceStats>;
            getFaceThumbnail: (faceId: number) => Promise<string | null>;
            getFaceInfo: (faceId: number) => Promise<{ id: number; image_id: number; image_path: string; person_id: number | null } | null>;

            // People operations
            getAllPeople: () => Promise<PersonRecord[]>;
            createPersonFromFace: (faceId: number, name: string) => Promise<number | null>;
            createPersonFromCluster: (faceIds: number[], name: string) => Promise<number | null>;
            assignFaceToPerson: (faceId: number, personId: number) => Promise<boolean>;
            getImagesByPerson: (personId: number) => Promise<LibraryImage[]>;
            updatePersonName: (personId: number, name: string) => Promise<boolean>;
            setPersonHidden: (personId: number, hidden: boolean) => Promise<boolean>;
            getHiddenPeople: () => Promise<PersonRecord[]>;

            // Album operations
            createAlbum: (name: string, description?: string) => Promise<AlbumRecord | null>;
            getAlbums: () => Promise<AlbumRecord[]>;
            getAlbumImages: (albumId: number) => Promise<LibraryImage[]>;
            addPhotosToAlbum: (albumId: number, imageIds: number[]) => Promise<{ added: number }>;
            removePhotosFromAlbum: (albumId: number, imageIds: number[]) => Promise<{ removed: number }>;
            updateAlbum: (albumId: number, updates: { name?: string; description?: string; cover_image_id?: number | null }) => Promise<boolean>;
            deleteAlbum: (albumId: number) => Promise<boolean>;

            // Event listeners
            onImportProgress: (callback: (progress: ImportProgress) => void) => () => void;
            onStartFaceDetection: (callback: (data: { imagePaths: { filePath: string; fileName: string }[] }) => void) => () => void;

            // Export operations
            showExportSaveDialog: (defaultPath: string, format: 'jpeg' | 'png') => Promise<string | null>;
            exportImage: (options: { dataUrl: string; outputPath: string; format: 'jpeg' | 'png'; quality: number }) => Promise<{ success: boolean; path?: string; error?: string }>;

            // Preset operations
            loadPresets: () => Promise<unknown[]>;
            savePresets: (presets: unknown[]) => Promise<{ success: boolean; error?: string }>;

            // Menu actions
            onMenuAction: (callback: (action: string, data?: unknown) => void) => () => void;
        };
    }
}
