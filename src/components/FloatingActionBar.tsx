/**
 * Floating Action Bar Component
 * Appears when images are selected, provides bulk actions like adding to album, tagging, deleting.
 */

import { useState, useEffect } from 'react';
import { X, FolderPlus, Tag, Trash2, Check, Plus, Loader2 } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import type { AlbumRecord } from '../../shared/types';

export function FloatingActionBar() {
    const {
        selectedImageIds,
        clearSelection,
        albums,
        loadAlbums,
        createAlbum,
        addSelectedToAlbum,
    } = useLibraryStore();

    const [showAlbumMenu, setShowAlbumMenu] = useState(false);
    const [showNewAlbumInput, setShowNewAlbumInput] = useState(false);
    const [newAlbumName, setNewAlbumName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Load albums on mount
    useEffect(() => {
        loadAlbums();
    }, [loadAlbums]);

    const selectedCount = selectedImageIds.size;

    // Don't render if nothing is selected
    if (selectedCount === 0) {
        return null;
    }

    const handleAddToAlbum = async (album: AlbumRecord) => {
        await addSelectedToAlbum(album.id);
        setShowAlbumMenu(false);
    };

    const handleCreateNewAlbum = async () => {
        if (!newAlbumName.trim()) return;

        setIsCreating(true);
        const album = await createAlbum(newAlbumName.trim());
        if (album) {
            await addSelectedToAlbum(album.id);
        }
        setNewAlbumName('');
        setShowNewAlbumInput(false);
        setShowAlbumMenu(false);
        setIsCreating(false);
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
            {/* Glassmorphism container */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 shadow-2xl">
                {/* Selection count */}
                <div className="flex items-center gap-2 pr-3 border-r border-gray-700">
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-medium text-white">
                        {selectedCount} selected
                    </span>
                </div>

                {/* Add to Album */}
                <div className="relative">
                    <button
                        onClick={() => setShowAlbumMenu(!showAlbumMenu)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm transition-colors"
                    >
                        <FolderPlus className="w-4 h-4" />
                        <span>Add to Album</span>
                    </button>

                    {/* Album dropdown */}
                    {showAlbumMenu && (
                        <div className="absolute bottom-full left-0 mb-2 w-56 bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
                            <div className="p-2 border-b border-gray-700">
                                {showNewAlbumInput ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newAlbumName}
                                            onChange={(e) => setNewAlbumName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateNewAlbum()}
                                            placeholder="Album name..."
                                            className="flex-1 px-2 py-1 text-sm bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleCreateNewAlbum}
                                            disabled={isCreating}
                                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm disabled:opacity-50"
                                        >
                                            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowNewAlbumInput(true)}
                                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-blue-400 hover:bg-gray-700 text-sm"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Create New Album</span>
                                    </button>
                                )}
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                                {albums.length === 0 ? (
                                    <div className="p-3 text-center text-gray-500 text-sm">
                                        No albums yet
                                    </div>
                                ) : (
                                    albums.map((album) => (
                                        <button
                                            key={album.id}
                                            onClick={() => handleAddToAlbum(album)}
                                            className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-700 text-left"
                                        >
                                            <div className="w-8 h-8 rounded bg-gray-700 overflow-hidden flex-shrink-0">
                                                {album.cover_path ? (
                                                    <img
                                                        src={`media://${encodeURIComponent(album.cover_path)}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                                        <FolderPlus className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-white truncate">{album.name}</div>
                                                <div className="text-xs text-gray-500">{album.photo_count ?? 0} photos</div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Add Tags (placeholder) */}
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm transition-colors">
                    <Tag className="w-4 h-4" />
                    <span>Add Tag</span>
                </button>

                {/* Delete */}
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-900/50 hover:bg-red-800 text-red-200 text-sm transition-colors">
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                </button>

                {/* Clear selection */}
                <button
                    onClick={clearSelection}
                    className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                    title="Clear selection"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
