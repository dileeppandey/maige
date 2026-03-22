/**
 * Floating Action Bar Component
 * Appears when images are selected, provides bulk actions like adding to album, tagging, deleting.
 */

import { useState, useEffect } from 'react';
import { X, FolderPlus, Tag, Trash2, Check, Plus } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import type { AlbumRecord } from '../../shared/types';
import { assetUrl } from '../utils/assetUrl';
import { Button, Badge } from '../design-system';

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
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface-card/95 backdrop-blur-xl border border-border-base shadow-2xl">
                {/* Selection count */}
                <div className="flex items-center gap-2 pr-3 border-r border-border-base">
                    <Badge variant="accent">
                        <Check className="w-3 h-3" />
                    </Badge>
                    <span className="text-sm font-medium text-text-primary">
                        {selectedCount} selected
                    </span>
                </div>

                {/* Add to Album */}
                <div className="relative">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowAlbumMenu(!showAlbumMenu)}
                        leftIcon={<FolderPlus className="w-4 h-4" />}
                    >
                        Add to Album
                    </Button>

                    {/* Album dropdown */}
                    {showAlbumMenu && (
                        <div className="absolute bottom-full left-0 mb-2 w-56 bg-surface-card rounded-lg border border-border-base shadow-xl overflow-hidden">
                            <div className="p-2 border-b border-border-base">
                                {showNewAlbumInput ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newAlbumName}
                                            onChange={(e) => setNewAlbumName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateNewAlbum()}
                                            placeholder="Album name..."
                                            className="flex-1 px-2 py-1 text-sm bg-surface-input border border-border-base rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                                            autoFocus
                                        />
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={handleCreateNewAlbum}
                                            disabled={isCreating}
                                            loading={isCreating}
                                        >
                                            {!isCreating && <Check className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        variant="link"
                                        size="sm"
                                        onClick={() => setShowNewAlbumInput(true)}
                                        className="w-full"
                                        leftIcon={<Plus className="w-4 h-4" />}
                                    >
                                        Create New Album
                                    </Button>
                                )}
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                                {albums.length === 0 ? (
                                    <div className="p-3 text-center text-text-secondary text-sm">
                                        No albums yet
                                    </div>
                                ) : (
                                    albums.map((album) => (
                                        <button
                                            key={album.id}
                                            onClick={() => handleAddToAlbum(album)}
                                            className="flex items-center gap-3 w-full px-3 py-2 hover:bg-surface-hover text-left"
                                        >
                                            <div className="w-8 h-8 rounded bg-surface-raised overflow-hidden flex-shrink-0">
                                                {album.cover_path ? (
                                                    <img
                                                        src={assetUrl(album.cover_path)}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-text-secondary">
                                                        <FolderPlus className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-text-primary truncate">{album.name}</div>
                                                <div className="text-xs text-text-secondary">{album.photo_count ?? 0} photos</div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Add Tags (placeholder) */}
                <Button variant="secondary" size="sm" leftIcon={<Tag className="w-4 h-4" />}>
                    Add Tag
                </Button>

                {/* Delete */}
                <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-4 h-4" />}>
                    Delete
                </Button>

                {/* Clear selection */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    title="Clear selection"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
