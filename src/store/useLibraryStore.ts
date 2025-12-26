import { create } from 'zustand';
import type { LibraryImage, DuplicateGroup, LibraryStats, ImportProgress, TagInfo, SearchResult } from '../../shared/types';

interface LibraryState {
    // Data
    images: LibraryImage[];
    duplicateGroups: DuplicateGroup[];
    stats: LibraryStats;
    tags: TagInfo[];

    // Search state
    searchQuery: string;
    searchResults: SearchResult[];
    isSearching: boolean;

    // Import state
    isImporting: boolean;
    importProgress: ImportProgress | null;

    // Actions
    loadImages: () => Promise<void>;
    loadDuplicates: () => Promise<void>;
    loadStats: () => Promise<void>;
    loadTags: () => Promise<void>;
    importFolder: (path: string) => Promise<void>;
    setImportProgress: (progress: ImportProgress | null) => void;
    search: (query: string) => Promise<void>;
    clearSearch: () => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
    // Initial state
    images: [],
    duplicateGroups: [],
    stats: { totalImages: 0, duplicateGroups: 0 },
    tags: [],
    searchQuery: '',
    searchResults: [],
    isSearching: false,
    isImporting: false,
    importProgress: null,

    // Load all images from database
    loadImages: async () => {
        try {
            const images = await window.electronAPI.getLibraryImages();
            set({ images });
        } catch (error) {
            console.error('Failed to load images:', error);
        }
    },

    // Load duplicate groups
    loadDuplicates: async () => {
        try {
            const duplicateGroups = await window.electronAPI.getDuplicates();
            set({ duplicateGroups });
        } catch (error) {
            console.error('Failed to load duplicates:', error);
        }
    },

    // Load library statistics
    loadStats: async () => {
        try {
            const stats = await window.electronAPI.getStats();
            set({ stats });
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    },

    // Load all tags
    loadTags: async () => {
        try {
            const tags = await window.electronAPI.getTags();
            set({ tags });
        } catch (error) {
            console.error('Failed to load tags:', error);
        }
    },

    // Import a folder
    importFolder: async (path: string) => {
        set({ isImporting: true, importProgress: null });

        try {
            const result = await window.electronAPI.importFolder(path);

            if (result.success) {
                // Refresh data after import
                await get().loadImages();
                await get().loadDuplicates();
                await get().loadStats();
                await get().loadTags();
            } else {
                console.error('Import failed:', result.error);
            }
        } catch (error) {
            console.error('Import error:', error);
        } finally {
            set({ isImporting: false, importProgress: null });
        }
    },

    // Update import progress
    setImportProgress: (progress) => {
        set({ importProgress: progress });
    },

    // Semantic search
    search: async (query: string) => {
        if (!query.trim()) {
            set({ searchQuery: '', searchResults: [], isSearching: false });
            return;
        }

        set({ searchQuery: query, isSearching: true });

        try {
            const results = await window.electronAPI.search(query);
            set({ searchResults: results, isSearching: false });
        } catch (error) {
            console.error('Search failed:', error);
            set({ searchResults: [], isSearching: false });
        }
    },

    // Clear search
    clearSearch: () => {
        set({ searchQuery: '', searchResults: [], isSearching: false });
    },
}));

// Setup progress listener (call once on app init)
export function setupLibraryProgressListener() {
    return window.electronAPI.onImportProgress((progress) => {
        useLibraryStore.getState().setImportProgress(progress as ImportProgress);
    });
}

