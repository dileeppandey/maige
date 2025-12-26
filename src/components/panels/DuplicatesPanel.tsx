/**
 * Duplicates Panel Component
 * Displays groups of duplicate/similar images for review and management
 */

import { useEffect, useState, useCallback } from 'react';
import { Copy, Trash2, Check, Loader2, ArrowLeft } from 'lucide-react';
import type { DuplicateGroup, LibraryImage } from '../../../shared/types';
import { useLibraryStore } from '../../store/useLibraryStore';

interface DuplicatesPanelProps {
    onSelectImage?: (path: string) => void;
}

export function DuplicatesPanel({ onSelectImage }: DuplicatesPanelProps) {
    const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedInGroup, setSelectedInGroup] = useState<Record<number, Set<number>>>({});
    const { showAllPhotos } = useLibraryStore();

    const loadDuplicates = useCallback(async () => {
        setIsLoading(true);
        try {
            const groups = await window.electronAPI.getDuplicates();
            setDuplicateGroups(groups);
        } catch (error) {
            console.error('Failed to load duplicates:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDuplicates();
    }, [loadDuplicates]);

    const toggleSelection = (groupIndex: number, imageId: number) => {
        setSelectedInGroup(prev => {
            const groupSet = prev[groupIndex] || new Set();
            const newSet = new Set(groupSet);
            if (newSet.has(imageId)) {
                newSet.delete(imageId);
            } else {
                newSet.add(imageId);
            }
            return { ...prev, [groupIndex]: newSet };
        });
    };

    const handleDeleteSelected = async (groupIndex: number, images: LibraryImage[]) => {
        const selected = selectedInGroup[groupIndex];
        if (!selected || selected.size === 0) return;

        // Get the image IDs to delete
        const imageIdsToDelete = images
            .filter(img => selected.has(img.id))
            .map(img => img.id);

        if (imageIdsToDelete.length === 0) return;

        const confirmDelete = window.confirm(
            `Delete ${imageIdsToDelete.length} selected image(s)? This will remove them from the library and delete the files. This cannot be undone.`
        );

        if (!confirmDelete) return;

        try {
            const result = await window.electronAPI.deleteImages(imageIdsToDelete, true);
            if (result.success) {
                console.log(`Deleted ${result.deletedFromDb} from DB, ${result.deletedFromDisk} from disk`);
                setSelectedInGroup(prev => ({ ...prev, [groupIndex]: new Set() }));
                await loadDuplicates();
            } else {
                console.error('Delete failed:', result.error);
                alert('Failed to delete images: ' + result.error);
            }
        } catch (error) {
            console.error('Failed to delete images:', error);
            alert('Failed to delete images');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-[#252525]">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#252525] text-white">
            {/* Header */}
            <div className="p-3 border-b border-[#333333]">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => showAllPhotos()}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                        title="Back to Library"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <Copy className="w-4 h-4 text-orange-500" />
                    <h2 className="text-sm font-medium">Duplicates</h2>
                    <span className="text-xs text-gray-400">
                        {duplicateGroups.length} group{duplicateGroups.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3">
                {duplicateGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Copy className="w-12 h-12 mb-2 opacity-50" />
                        <p className="text-sm">No duplicate images found</p>
                        <p className="text-xs mt-1">Import images to detect duplicates</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {duplicateGroups.map((group, groupIndex) => {
                            const selected = selectedInGroup[groupIndex] || new Set();
                            return (
                                <div key={group.groupId} className="bg-gray-700/50 rounded-lg p-3">
                                    {/* Group header */}
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-gray-400">
                                            Group {groupIndex + 1} • {group.images.length} similar images
                                        </span>
                                        {selected.size > 0 && (
                                            <button
                                                onClick={() => handleDeleteSelected(groupIndex, group.images)}
                                                className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                                Delete {selected.size}
                                            </button>
                                        )}
                                    </div>

                                    {/* Thumbnails */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {group.images.map((image) => (
                                            <div
                                                key={image.id}
                                                className={`relative aspect-square rounded overflow-hidden cursor-pointer border-2 transition-all ${selected.has(image.id)
                                                    ? 'border-red-500'
                                                    : 'border-transparent hover:border-blue-400'
                                                    }`}
                                                onClick={() => toggleSelection(groupIndex, image.id)}
                                            >
                                                <img
                                                    src={`media://${encodeURIComponent(image.file_path)}`}
                                                    alt={image.file_path.split('/').pop()}
                                                    className="w-full h-full object-cover"
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectImage?.(image.file_path);
                                                    }}
                                                />
                                                {/* Selection indicator */}
                                                <div className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selected.has(image.id)
                                                    ? 'bg-red-500 border-red-500'
                                                    : 'bg-gray-800/60 border-gray-400'
                                                    }`}>
                                                    {selected.has(image.id) && (
                                                        <Check className="w-3 h-3 text-white" />
                                                    )}
                                                </div>
                                                {/* File name */}
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                                                    <span className="text-xs text-white truncate block">
                                                        {image.file_path.split('/').pop()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer info */}
            <div className="p-2 border-t border-[#333333] text-xs text-gray-500 text-center">
                Click to select • Double-click to view • Select duplicates to delete
            </div>
        </div>
    );
}
