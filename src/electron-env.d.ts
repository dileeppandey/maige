import { FileInfo, LibraryImage, DuplicateGroup, LibraryStats, ImportProgress, ImportResult, TagInfo, SearchResult } from '../shared/types';

export { };

declare global {
    interface Window {
        electronAPI: {
            versions: {
                node: () => string;
                chrome: () => string;
                electron: () => string;
            };
            selectFolder: () => Promise<string | null>;
            readFolder: (path: string) => Promise<FileInfo[]>;

            // Library operations
            importFolder: (path: string) => Promise<ImportResult>;
            getLibraryImages: () => Promise<LibraryImage[]>;
            getDuplicates: () => Promise<DuplicateGroup[]>;
            getStats: () => Promise<LibraryStats>;
            onImportProgress: (callback: (progress: ImportProgress) => void) => () => void;

            // Tags and search
            getTags: () => Promise<TagInfo[]>;
            getImagesByTag: (tag: string) => Promise<LibraryImage[]>;
            getImageTagsByPath: (filePath: string) => Promise<{ tag: string; score: number; category: string | null }[]>;
            search: (query: string) => Promise<SearchResult[]>;
        };
    }
}
