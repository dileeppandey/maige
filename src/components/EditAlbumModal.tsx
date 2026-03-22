/**
 * Edit Album Modal Component
 * Allows editing album name and description
 */

import { useState, useEffect } from 'react';
import { Save, Folder } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, Textarea } from '../design-system';
import type { AlbumRecord } from '../../shared/types';
import { assetUrl } from '../utils/assetUrl';

interface EditAlbumModalProps {
    album: AlbumRecord;
    onClose: () => void;
    isOpen?: boolean;
}

export function EditAlbumModal({ album, onClose, isOpen = true }: EditAlbumModalProps) {
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
            await window.api.updateAlbum(album.id, {
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

    const headerIcon = album.cover_path ? (
        <img src={assetUrl(album.cover_path)} className="w-5 h-5 rounded object-cover" />
    ) : (
        <Folder size={18} />
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md">
            <ModalHeader onClose={onClose} icon={headerIcon}>Edit Album</ModalHeader>
            <ModalBody className="space-y-4">
                    {/* Name Field */}
                    <Input
                        label="Album Name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter album name..."
                        autoFocus
                    />

                    {/* Description Field */}
                    <Textarea
                        label="Description (optional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add a description for this album..."
                        rows={3}
                    />

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                        <span>{album.photo_count ?? 0} photos</span>
                        <span>Created {new Date(album.created_at).toLocaleDateString()}</span>
                    </div>
            </ModalBody>

            <ModalFooter>
                <Button variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving || !name.trim()}
                    loading={isSaving}
                    leftIcon={!isSaving ? <Save size={14} /> : undefined}
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
