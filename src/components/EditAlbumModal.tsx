/**
 * Edit Album Modal Component
 * Allows editing album name and description
 */

import { useState, useEffect } from 'react';
import { X, Save, Folder } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import type { AlbumRecord } from '../../shared/types';

interface EditAlbumModalProps {
    album: AlbumRecord;
    onClose: () => void;
}

export function EditAlbumModal({ album, onClose }: EditAlbumModalProps) {
    const { loadAlbums } = useLibraryStore();
    const [name, setName] = useState(album.name);
    const [description, setDescription] = useState(album.description || '');
    const [isSaving, setIsSaving] = useState(false);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const handleSave = async () => {
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            await window.electronAPI.updateAlbum(album.id, {
                name: name.trim(),
                description: description.trim() || undefined,
            });
            await loadAlbums();
            onClose();
        } catch (error) {
            console.error('Failed to update album:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-gray-900 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                            {album.cover_path ? (
                                <img
                                    src={`media://${encodeURIComponent(album.cover_path)}`}
                                    className="w-full h-full rounded-lg object-cover"
                                />
                            ) : (
                                <Folder className="w-5 h-5 text-gray-500" />
                            )}
                        </div>
                        <h2 className="text-lg font-semibold text-white">Edit Album</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-5 space-y-4">
                    {/* Name Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Album Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter album name..."
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            autoFocus
                        />
                    </div>

                    {/* Description Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Description
                            <span className="text-gray-500 font-normal ml-1">(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add a description for this album..."
                            rows={3}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{album.photo_count ?? 0} photos</span>
                        <span>Created {new Date(album.created_at).toLocaleDateString()}</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-700 bg-gray-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !name.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
