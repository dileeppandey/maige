/**
 * Create Album Modal Component
 * Allows creating a new album with title, description, and photo selection by people/tags
 */

import { useState, useEffect } from 'react';
import { X, Plus, Folder, Users, Tag, Check, Loader2 } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import type { TagInfo, PersonRecord } from '../../shared/types';

interface CreateAlbumModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateAlbumModal({ isOpen, onClose }: CreateAlbumModalProps) {
    const { createAlbum, loadAlbums, showAlbum } = useLibraryStore();

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Selection state
    const [availablePeople, setAvailablePeople] = useState<(PersonRecord & { face_count: number })[]>([]);
    const [availableTags, setAvailableTags] = useState<TagInfo[]>([]);
    const [selectedPeopleIds, setSelectedPeopleIds] = useState<Set<number>>(new Set());
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

    // Loading states
    const [loadingPeople, setLoadingPeople] = useState(false);
    const [loadingTags, setLoadingTags] = useState(false);

    // Load people and tags when modal opens
    useEffect(() => {
        if (isOpen) {
            loadPeople();
            loadTags();
        }
    }, [isOpen]);

    const loadPeople = async () => {
        setLoadingPeople(true);
        try {
            const people = await window.electronAPI.getAllPeople();
            // Only show named people (not unnamed clusters)
            setAvailablePeople(people.filter(p => p.name && p.name.trim() !== ''));
        } catch (error) {
            console.error('Failed to load people:', error);
        } finally {
            setLoadingPeople(false);
        }
    };

    const loadTags = async () => {
        setLoadingTags(true);
        try {
            const tags = await window.electronAPI.getTags();
            setAvailableTags(tags);
        } catch (error) {
            console.error('Failed to load tags:', error);
        } finally {
            setLoadingTags(false);
        }
    };

    // Toggle person selection
    const togglePerson = (personId: number) => {
        setSelectedPeopleIds(prev => {
            const next = new Set(prev);
            if (next.has(personId)) {
                next.delete(personId);
            } else {
                next.add(personId);
            }
            return next;
        });
    };

    // Toggle tag selection
    const toggleTag = (tagName: string) => {
        setSelectedTags(prev => {
            const next = new Set(prev);
            if (next.has(tagName)) {
                next.delete(tagName);
            } else {
                next.add(tagName);
            }
            return next;
        });
    };

    // Handle create album
    const handleCreate = async () => {
        if (!title.trim()) return;

        setIsCreating(true);
        try {
            // 1. Create the album
            const album = await createAlbum(title.trim(), description.trim() || undefined);
            if (!album) {
                console.error('Failed to create album');
                return;
            }

            // 2. Gather image IDs from selected people
            const imageIdsSet = new Set<number>();

            for (const personId of selectedPeopleIds) {
                const images = await window.electronAPI.getImagesByPerson(personId);
                images.forEach(img => imageIdsSet.add(img.id));
            }

            // 3. Gather image IDs from selected tags
            for (const tagName of selectedTags) {
                const images = await window.electronAPI.getImagesByTag(tagName);
                images.forEach(img => imageIdsSet.add(img.id));
            }

            // 4. Add photos to album if any were selected
            if (imageIdsSet.size > 0) {
                await window.electronAPI.addPhotosToAlbum(album.id, Array.from(imageIdsSet));
            }

            // 5. Refresh albums and show the new album
            await loadAlbums();
            showAlbum(album.id);

            // Close modal and reset state
            handleClose();
        } catch (error) {
            console.error('Failed to create album:', error);
        } finally {
            setIsCreating(false);
        }
    };

    // Reset and close
    const handleClose = () => {
        setTitle('');
        setDescription('');
        setSelectedPeopleIds(new Set());
        setSelectedTags(new Set());
        onClose();
    };

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setTitle('');
                setDescription('');
                setSelectedPeopleIds(new Set());
                setSelectedTags(new Set());
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const hasSelections = selectedPeopleIds.size > 0 || selectedTags.size > 0;
    const canCreate = title.trim().length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-[#1e1e1e] rounded-xl border border-gray-700 shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                            <Folder className="w-5 h-5 text-blue-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Create Album</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    {/* Title Input */}
                    <div>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Add a title"
                            className="w-full text-2xl font-light bg-transparent border-b border-gray-600 pb-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                            autoFocus
                        />
                    </div>

                    {/* Description Input */}
                    <div>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add a description (optional)"
                            rows={2}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none text-sm"
                        />
                    </div>

                    {/* Add Photos Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-gray-400">Add photos</h3>

                        {/* Select People */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <Users className="w-4 h-4 text-purple-400" />
                                <span>Select people</span>
                                {loadingPeople && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
                            </div>
                            {availablePeople.length === 0 && !loadingPeople ? (
                                <p className="text-xs text-gray-500 pl-6">No named people found. Name people in the People panel first.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2 pl-6">
                                    {availablePeople.map(person => (
                                        <button
                                            key={person.id}
                                            onClick={() => togglePerson(person.id)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${selectedPeopleIds.has(person.id)
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                }`}
                                        >
                                            {selectedPeopleIds.has(person.id) && <Check className="w-3 h-3" />}
                                            {person.name}
                                            <span className="text-xs opacity-60">({person.face_count})</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Select Tags */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <Tag className="w-4 h-4 text-blue-400" />
                                <span>Select tags</span>
                                {loadingTags && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
                            </div>
                            {availableTags.length === 0 && !loadingTags ? (
                                <p className="text-xs text-gray-500 pl-6">No tags found. Import a folder to generate AI tags.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2 pl-6 max-h-32 overflow-y-auto">
                                    {availableTags.slice(0, 20).map(tag => (
                                        <button
                                            key={tag.tag}
                                            onClick={() => toggleTag(tag.tag)}
                                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm transition-all ${selectedTags.has(tag.tag)
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                }`}
                                        >
                                            {selectedTags.has(tag.tag) && <Check className="w-3 h-3" />}
                                            {tag.tag}
                                            <span className="text-xs opacity-60">{tag.count}</span>
                                        </button>
                                    ))}
                                    {availableTags.length > 20 && (
                                        <span className="text-xs text-gray-500 self-center">+{availableTags.length - 20} more</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selection Summary */}
                    {hasSelections && (
                        <div className="bg-gray-800/50 rounded-lg p-3 text-sm text-gray-300">
                            <span className="text-gray-400">Album will include photos from: </span>
                            {selectedPeopleIds.size > 0 && (
                                <span className="text-purple-400">
                                    {selectedPeopleIds.size} {selectedPeopleIds.size === 1 ? 'person' : 'people'}
                                </span>
                            )}
                            {selectedPeopleIds.size > 0 && selectedTags.size > 0 && <span>, </span>}
                            {selectedTags.size > 0 && (
                                <span className="text-blue-400">
                                    {selectedTags.size} {selectedTags.size === 1 ? 'tag' : 'tags'}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700 bg-gray-900/50">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!canCreate || isCreating}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4" />
                                Create Album
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
