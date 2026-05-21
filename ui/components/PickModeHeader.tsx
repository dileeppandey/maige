/**
 * Pick Mode Header Component
 * Shown when user is in "Add Photos to Album" mode
 */

import { X, Check, Plus } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';

export function PickModeHeader() {
    const {
        addingToAlbumId,
        albums,
        selectedImageIds,
        confirmAddToAlbum,
        cancelAddToAlbum
    } = useLibraryStore();

    // Don't render if not in pick mode
    if (!addingToAlbumId) {
        return null;
    }

    const album = albums.find(a => a.id === addingToAlbumId);
    const albumName = album?.name || 'Album';
    const selectedCount = selectedImageIds.size;

    return (
        <div className="fixed top-0 left-0 right-0 h-12 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between px-4 z-50 shadow-lg">
            {/* Left side - Album info */}
            <div className="flex items-center gap-3">
                <Plus className="w-5 h-5 text-white" />
                <span className="text-white font-medium">
                    Adding to: <span className="font-bold">{albumName}</span>
                </span>
            </div>

            {/* Center - Selection count */}
            <div className="text-white/80 text-sm">
                {selectedCount > 0 ? (
                    <span>{selectedCount} photo{selectedCount !== 1 ? 's' : ''} selected</span>
                ) : (
                    <span>⌘+Click photos to select</span>
                )}
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={cancelAddToAlbum}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                >
                    <X className="w-4 h-4" />
                    Cancel
                </button>
                <button
                    onClick={confirmAddToAlbum}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-blue-600 font-medium text-sm transition-colors hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Check className="w-4 h-4" />
                    Add {selectedCount > 0 ? `${selectedCount} Photo${selectedCount !== 1 ? 's' : ''}` : ''}
                </button>
            </div>
        </div>
    );
}
