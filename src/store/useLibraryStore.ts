import { create } from 'zustand';
import type { LibraryImage, DuplicateGroup, LibraryStats, ImportProgress, TagInfo, SearchResult, AlbumRecord } from '../../shared/types';

interface LibraryState {
    // Data
    images: LibraryImage[];
    duplicateGroups: DuplicateGroup[];
    stats: LibraryStats;
    tags: TagInfo[];
    albums: AlbumRecord[];

    // Selection state for bulk operations
    selectedImageIds: Set<number>;

    // View mode: 'folder' = current folder, 'library' = all photos, 'search' = search results, 'tag' = tag filter, 'people' = people panel, 'duplicates' = duplicate groups, 'album' = album view
    viewMode: 'folder' | 'library' | 'search' | 'tag' | 'people' | 'duplicates' | 'album';
    selectedAlbumId: number | null;

    // "Add Photos to Album" pick mode
    addingToAlbumId: number | null;
    albumExistingImageIds: Set<number>; // IDs of images already in the target album

    // Search state
    searchQuery: string;
    searchResults: SearchResult[];
    isSearching: boolean;

    // Import state
    isImporting: boolean;
    importProgress: ImportProgress | null;

    // Pagination state
    pageSize: number;
    hasMore: boolean;

    // Cache busting for edited images
    imageCacheVersion: number;

    // Actions
    loadImages: (loadMore?: boolean) => Promise<void>;
    loadDuplicates: () => Promise<void>;
    loadStats: () => Promise<void>;
    loadTags: () => Promise<void>;
    loadAlbums: () => Promise<void>;
    importFolder: (path: string) => Promise<void>;
    setImportProgress: (progress: ImportProgress | null) => void;
    search: (query: string) => Promise<void>;
    clearSearch: () => void;
    filterByTag: (tagName: string, loadMore?: boolean) => Promise<void>;
    showAllPhotos: (loadMore?: boolean) => Promise<void>;
    showPeople: () => void;
    showDuplicates: () => Promise<void>;
    showAlbum: (albumId: number) => void;
    loadMore: () => Promise<void>;

    // Selection actions
    toggleImageSelection: (imageId: number) => void;
    selectImages: (imageIds: number[]) => void;
    clearSelection: () => void;
    selectAll: () => void;
    invertSelection: () => void;

    // Metadata actions
    setRating: (rating: number) => Promise<void>;
    setFlag: (flag: 'pick' | 'reject' | 'none') => Promise<void>;

    // Album actions
    createAlbum: (name: string, description?: string) => Promise<AlbumRecord | null>;
    addSelectedToAlbum: (albumId: number) => Promise<void>;
    deleteAlbum: (albumId: number) => Promise<void>;

    startAddingToAlbum: (albumId: number) => Promise<void>;
    confirmAddToAlbum: () => Promise<void>;
    cancelAddToAlbum: () => void;

    // Cache invalidation
    invalidateImageCache: () => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
    // Initial state
    images: [],
    duplicateGroups: [],
    stats: { totalImages: 0, duplicateGroups: 0 },
    tags: [],
    albums: [],
    selectedImageIds: new Set(),
    viewMode: 'folder',
    selectedAlbumId: null,
    addingToAlbumId: null,
    albumExistingImageIds: new Set(),
    searchQuery: '',
    searchResults: [],
    isSearching: false,
    isImporting: false,
    importProgress: null,
    pageSize: 100,
    hasMore: true,
    imageCacheVersion: 0,

    // Load images from database with pagination
    loadImages: async (loadMore = false) => {
        try {
            const { images, pageSize, hasMore: currentHasMore } = get();
            if (loadMore && !currentHasMore) return;

            const offset = loadMore ? images.length : 0;
            const newImages = await window.electronAPI.getLibraryImages({ limit: pageSize, offset });

            set((state) => ({
                images: loadMore ? [...state.images, ...newImages] : newImages,
                hasMore: newImages.length === pageSize
            }));
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
            set({ searchQuery: '', searchResults: [], isSearching: false, viewMode: 'library' });
            return;
        }

        set({ searchQuery: query, isSearching: true, viewMode: 'search' });

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

    // Filter by exact tag match with pagination
    filterByTag: async (tagName: string, loadMore = false) => {
        const { searchResults, pageSize, hasMore: currentHasMore } = get();
        if (loadMore && !currentHasMore) return;

        set({ searchQuery: tagName, isSearching: true });

        try {
            const offset = loadMore ? searchResults.length : 0;
            const images = await window.electronAPI.getImagesByTag(tagName, { limit: pageSize, offset });

            // Convert LibraryImage[] to SearchResult[] format
            const newResults = images.map(img => ({
                id: img.id,
                file_path: img.file_path,
                similarity: 1.0, // Exact match
            }));

            set((state) => ({
                searchResults: loadMore ? [...state.searchResults, ...newResults] : newResults,
                isSearching: false,
                viewMode: 'tag',
                hasMore: newResults.length === pageSize
            }));
        } catch (error) {
            console.error('Filter by tag failed:', error);
            set({ isSearching: false });
        }
    },

    // Show all library photos with pagination
    showAllPhotos: async (loadMore = false) => {
        try {
            const { searchResults, pageSize, hasMore: currentHasMore } = get();
            if (loadMore && !currentHasMore) return;

            const offset = loadMore ? searchResults.length : 0;
            const images = await window.electronAPI.getLibraryImages({ limit: pageSize, offset });

            const newResults = images.map(img => ({
                id: img.id,
                file_path: img.file_path,
                similarity: 1.0,
            }));

            set((state) => ({
                searchQuery: '',
                searchResults: loadMore ? [...state.searchResults, ...newResults] : newResults,
                isSearching: false,
                viewMode: 'library',
                hasMore: newResults.length === pageSize
            }));
        } catch (error) {
            console.error('Failed to load all photos:', error);
        }
    },

    // Load more unified action
    loadMore: async () => {
        const { viewMode, searchQuery } = get();
        if (viewMode === 'library') {
            await get().showAllPhotos(true);
        } else if (viewMode === 'tag' && searchQuery) {
            await get().filterByTag(searchQuery, true);
        } else if (viewMode === 'folder') {
            await get().loadImages(true);
        }
        // Others (search, album, people) don't have pagination implemented yet or are smaller
    },

    // Show people panel
    showPeople: () => {
        set({ viewMode: 'people', searchQuery: '', searchResults: [] });
    },

    // Show duplicates view
    showDuplicates: async () => {
        try {
            await get().loadDuplicates();
            set({ viewMode: 'duplicates', searchQuery: '', searchResults: [] });
        } catch (error) {
            console.error('Failed to show duplicates:', error);
        }
    },

    // Show album view
    showAlbum: (albumId: number) => {
        set({ viewMode: 'album', selectedAlbumId: albumId, searchQuery: '', searchResults: [] });
    },

    // Load albums
    loadAlbums: async () => {
        try {
            const albums = await window.electronAPI.getAlbums();
            set({ albums });
        } catch (error) {
            console.error('Failed to load albums:', error);
        }
    },

    // Selection actions
    toggleImageSelection: (imageId: number) => {
        set((state) => {
            const newSet = new Set(state.selectedImageIds);
            if (newSet.has(imageId)) {
                newSet.delete(imageId);
            } else {
                newSet.add(imageId);
            }
            return { selectedImageIds: newSet };
        });
    },

    selectImages: (imageIds: number[]) => {
        set((state) => {
            const newSet = new Set(state.selectedImageIds);
            imageIds.forEach(id => newSet.add(id));
            return { selectedImageIds: newSet };
        });
    },

    clearSelection: () => {
        set({ selectedImageIds: new Set() });
    },

    selectAll: () => {
        const { images, searchResults, viewMode } = get();
        const idsToSelect = viewMode === 'library' || viewMode === 'search' || viewMode === 'tag'
            ? searchResults.map(r => r.id)
            : images.map(i => i.id);
        set({ selectedImageIds: new Set(idsToSelect) });
    },

    invertSelection: () => {
        const { images, searchResults, viewMode, selectedImageIds } = get();
        const allIds = viewMode === 'library' || viewMode === 'search' || viewMode === 'tag'
            ? searchResults.map(r => r.id)
            : images.map(i => i.id);

        const newSet = new Set<number>();
        allIds.forEach(id => {
            if (!selectedImageIds.has(id)) {
                newSet.add(id);
            }
        });
        set({ selectedImageIds: newSet });
    },

    setRating: async (rating: number) => {
        const { selectedImageIds } = get();
        if (selectedImageIds.size === 0) return;

        set((state) => ({
            images: state.images.map(img =>
                selectedImageIds.has(img.id) ? { ...img, rating } : img
            ),
            searchResults: state.searchResults.map(res =>
                selectedImageIds.has(res.id) ? { ...res, rating } : res
            )
        }));

        // TODO: Persist to database via IPC
        console.log(`Setting rating ${rating} for ${selectedImageIds.size} images`);
    },

    setFlag: async (flag: 'pick' | 'reject' | 'none') => {
        const { selectedImageIds } = get();
        if (selectedImageIds.size === 0) return;

        set((state) => ({
            images: state.images.map(img =>
                selectedImageIds.has(img.id) ? { ...img, flag } : img
            ),
            searchResults: state.searchResults.map(res =>
                selectedImageIds.has(res.id) ? { ...res, flag } : res
            )
        }));

        // TODO: Persist to database via IPC
        console.log(`Setting flag ${flag} for ${selectedImageIds.size} images`);
    },

    // Album CRUD actions
    createAlbum: async (name: string, description?: string) => {
        try {
            const album = await window.electronAPI.createAlbum(name, description);
            if (album) {
                await get().loadAlbums();
            }
            return album;
        } catch (error) {
            console.error('Failed to create album:', error);
            return null;
        }
    },

    addSelectedToAlbum: async (albumId: number) => {
        const { selectedImageIds } = get();
        if (selectedImageIds.size === 0) return;

        try {
            await window.electronAPI.addPhotosToAlbum(albumId, Array.from(selectedImageIds));
            await get().loadAlbums();
            set({ selectedImageIds: new Set() });
        } catch (error) {
            console.error('Failed to add photos to album:', error);
        }
    },

    deleteAlbum: async (albumId: number) => {
        try {
            await window.electronAPI.deleteAlbum(albumId);
            await get().loadAlbums();
            if (get().selectedAlbumId === albumId) {
                set({ viewMode: 'library', selectedAlbumId: null });
            }
        } catch (error) {
            console.error('Failed to delete album:', error);
        }
    },

    // Start "Add Photos" pick mode - switch to library view while remembering target album
    startAddingToAlbum: async (albumId: number) => {
        // First, fetch the images already in this album
        try {
            const existingImages = await window.electronAPI.getAlbumImages(albumId);
            const existingIds = new Set(existingImages.map(img => img.id));

            set({
                addingToAlbumId: albumId,
                viewMode: 'library',
                selectedImageIds: new Set(),
                albumExistingImageIds: existingIds,
            });
        } catch (error) {
            console.error('Failed to load album images:', error);
            set({
                addingToAlbumId: albumId,
                viewMode: 'library',
                selectedImageIds: new Set(),
                albumExistingImageIds: new Set(),
            });
        }
        // Load all photos so user can pick from them
        get().showAllPhotos();
    },

    // Confirm adding selected photos to the target album
    confirmAddToAlbum: async () => {
        const { addingToAlbumId, selectedImageIds } = get();
        if (!addingToAlbumId || selectedImageIds.size === 0) {
            // Just exit pick mode if nothing selected
            set({ addingToAlbumId: null, viewMode: 'album', selectedImageIds: new Set(), albumExistingImageIds: new Set() });
            return;
        }

        try {
            await window.electronAPI.addPhotosToAlbum(addingToAlbumId, Array.from(selectedImageIds));
            await get().loadAlbums();
            // Return to viewing the album
            set({
                viewMode: 'album',
                selectedAlbumId: addingToAlbumId,
                addingToAlbumId: null,
                selectedImageIds: new Set(),
                albumExistingImageIds: new Set(),
            });
        } catch (error) {
            console.error('Failed to add photos to album:', error);
        }
    },

    // Cancel pick mode and return to album view
    cancelAddToAlbum: () => {
        const { addingToAlbumId } = get();
        set({
            viewMode: 'album',
            selectedAlbumId: addingToAlbumId,
            addingToAlbumId: null,
            selectedImageIds: new Set(),
            albumExistingImageIds: new Set(),
        });
    },

    // Increment cache version to force image reloads
    invalidateImageCache: () => {
        set((state) => ({ imageCacheVersion: state.imageCacheVersion + 1 }));
    },
}));

// Setup progress listener (call once on app init)
export function setupLibraryProgressListener() {
    return window.electronAPI.onImportProgress((progress) => {
        useLibraryStore.getState().setImportProgress(progress as ImportProgress);
    });
}

