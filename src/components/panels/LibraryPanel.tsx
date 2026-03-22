import { useEffect, useState, useRef } from 'react'
import type { AlbumRecord } from '../../../shared/types'
import { Images, Clock, Star, Trash2, Folder, Plus, Loader2, MoreHorizontal, ImagePlus, Pencil, Sparkles } from 'lucide-react'
import { useLibraryStore, setupLibraryProgressListener } from '../../store/useLibraryStore'
import { EditAlbumModal } from '../EditAlbumModal'
import { assetUrl } from '../../utils/assetUrl'
import { NavItem, Button, Input } from '../../design-system'

// CollectionsSection Component (renamed from AlbumsSection)
function CollectionsSection() {
    const { albums, loadAlbums, createAlbum, deleteAlbum, showAlbum, viewMode, selectedAlbumId, startAddingToAlbum } = useLibraryStore()
    const [showNewInput, setShowNewInput] = useState(false)
    const [newName, setNewName] = useState('')
    const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
    const [dragOverAlbumId, setDragOverAlbumId] = useState<number | null>(null)
    const [editingAlbum, setEditingAlbum] = useState<AlbumRecord | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        loadAlbums()
    }, [loadAlbums])

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuOpenId !== null && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpenId(null)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [menuOpenId])

    const handleCreate = async () => {
        if (!newName.trim()) return
        await createAlbum(newName.trim())
        setNewName('')
        setShowNewInput(false)
    }

    const handleDragOver = (e: React.DragEvent, albumId: number) => {
        e.preventDefault()
        setDragOverAlbumId(albumId)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOverAlbumId(null)
    }

    const handleDrop = async (e: React.DragEvent, albumId: number) => {
        e.preventDefault()
        setDragOverAlbumId(null)

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'))
            if (data && data.imageIds && Array.isArray(data.imageIds)) {
                await window.api.addPhotosToAlbum(albumId, data.imageIds)
                await loadAlbums()
            }
        } catch (error) {
            console.error('Failed to drop photos:', error)
        }
    }

    return (
        <div className="mt-2 px-3">
            <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                <span>Collections</span>
                <Button
                    onClick={() => setShowNewInput(!showNewInput)}
                    variant="ghost"
                    size="xs"
                    iconOnly
                    leftIcon={<Plus size={14} />}
                    title="Create Collection"
                />
            </div>

            {showNewInput && (
                <div className="px-2 mb-2 flex gap-1">
                    <Input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        placeholder="Collection name..."
                        autoFocus
                    />
                    <Button onClick={handleCreate} variant="primary" size="xs">
                        Add
                    </Button>
                </div>
            )}

            {albums.length === 0 ? (
                <div className="px-2 py-2 text-xs text-text-faint text-center">
                    No collections yet
                </div>
            ) : (
                <div className="space-y-0.5">
                    {albums.map((album) => (
                        <div
                            key={album.id}
                            className={`group relative ${dragOverAlbumId === album.id ? 'bg-accent/30 border border-accent/50 rounded-md' : ''}`}
                            onDragOver={(e) => handleDragOver(e, album.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, album.id)}
                        >
                            <NavItem
                                icon={
                                    <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0 bg-surface-card">
                                        {album.cover_path ? (
                                            <img
                                                src={assetUrl(album.cover_path)}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-text-muted">
                                                <Folder size={12} />
                                            </div>
                                        )}
                                    </div>
                                }
                                label={album.name}
                                count={album.photo_count ?? 0}
                                active={viewMode === 'album' && selectedAlbumId === album.id}
                                onClick={() => showAlbum(album.id)}
                            />

                            {/* Context menu trigger */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setMenuOpenId(menuOpenId === album.id ? null : album.id)
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 hover:bg-surface-hover rounded transition-opacity"
                            >
                                <MoreHorizontal size={14} />
                            </button>

                            {/* Context menu */}
                            {menuOpenId === album.id && (
                                <div
                                    ref={menuRef}
                                    className="absolute right-0 top-full mt-1 z-10 bg-surface-card border border-border-base rounded-lg shadow-xl py-1 min-w-[140px]"
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            startAddingToAlbum(album.id)
                                            setMenuOpenId(null)
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover w-full text-left"
                                    >
                                        <ImagePlus size={12} />
                                        Add Photos
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingAlbum(album)
                                            setMenuOpenId(null)
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover w-full text-left"
                                    >
                                        <Pencil size={12} />
                                        Edit Collection
                                    </button>
                                    <div className="border-t border-border-base my-1" />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            deleteAlbum(album.id)
                                            setMenuOpenId(null)
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-surface-hover w-full text-left"
                                    >
                                        <Trash2 size={12} />
                                        Delete Collection
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Album Modal */}
            {editingAlbum && (
                <EditAlbumModal
                    album={editingAlbum}
                    onClose={() => setEditingAlbum(null)}
                />
            )}
        </div>
    )
}

interface LibraryPanelProps {
    onSelectPerson?: (personId: number) => void
    onClearPerson?: () => void
}

export function LibraryPanel({ onSelectPerson: _onSelectPerson, onClearPerson }: LibraryPanelProps) {
    const {
        stats,
        isImporting,
        importProgress,
        searchQuery,
        viewMode,
        loadStats,
        loadTags,
        showAllPhotos,
    } = useLibraryStore()

    // Setup progress listener and load initial data
    useEffect(() => {
        const cleanup = setupLibraryProgressListener()
        loadStats()
        loadTags()
        showAllPhotos()
        return cleanup
    }, [loadStats, loadTags, showAllPhotos])

    // Format progress message
    const getProgressMessage = () => {
        if (!importProgress) return ''
        switch (importProgress.phase) {
            case 'scanning':
                return 'Scanning folder...'
            case 'analyzing':
                return `Analyzing ${importProgress.current}/${importProgress.total}`
            case 'saving':
                return `Saving ${importProgress.current}/${importProgress.total}`
            case 'detecting_duplicates':
                return 'Detecting duplicates...'
            case 'ai_tagging':
                return `AI tagging ${importProgress.current}/${importProgress.total}`
            case 'complete':
                return 'Import complete!'
            default:
                return ''
        }
    }

    // Format count with commas
    const formatCount = (count: number) => {
        return count.toLocaleString()
    }

    const isAllPhotosActive = viewMode === 'library' && !searchQuery

    return (
        <div className="h-full w-full flex flex-col bg-surface-panel border-r border-border-subtle">
            {/* Branding Header */}
            <div className="h-12 flex items-center gap-2.5 px-4 border-b border-border-subtle">
                <Sparkles size={18} className="text-accent" />
                <span className="font-semibold text-sm text-text-primary tracking-wide">Maige</span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Import Progress */}
                {isImporting && importProgress && (
                    <div className="mx-3 mt-3 px-3 py-2 text-xs bg-accent/10 border border-accent/20 rounded-lg text-accent">
                        <div className="flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin" />
                            <span>{getProgressMessage()}</span>
                        </div>
                        {importProgress.total > 0 && (
                            <div className="mt-1.5 h-1 bg-accent/20 rounded overflow-hidden">
                                <div
                                    className="h-full bg-accent transition-all duration-300"
                                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Nav Items */}
                <div className="px-3 pt-3 space-y-0.5">
                    {/* All Photos */}
                    <NavItem
                        icon={<Images size={16} />}
                        label="All Photos"
                        count={formatCount(stats.totalImages)}
                        active={isAllPhotosActive}
                        onClick={() => {
                            onClearPerson?.()
                            showAllPhotos()
                        }}
                    />

                    {/* Recent */}
                    <NavItem
                        icon={<Clock size={16} />}
                        label="Recent"
                    />

                    {/* Favorites */}
                    <NavItem
                        icon={<Star size={16} />}
                        label="Favorites"
                    />

                    {/* Trash */}
                    <NavItem
                        icon={<Trash2 size={16} />}
                        label="Trash"
                    />
                </div>

                {/* Divider */}
                <div className="mx-5 my-3 border-t border-border-subtle" />

                {/* Collections Section (formerly Albums) */}
                <CollectionsSection />
            </div>
        </div>
    )
}
