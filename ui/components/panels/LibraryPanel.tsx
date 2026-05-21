import { useEffect, useState, useRef } from 'react'
import type { AlbumRecord, PersonRecord } from '../../../shared/types'
import { FolderInput, Images, Copy, Loader2, Search, Tag, X, Folder, Plus, MoreHorizontal, Trash2, ImagePlus, Pencil } from 'lucide-react'
import { useLibraryStore, setupLibraryProgressListener } from '../../store/useLibraryStore'
import { EditAlbumModal } from '../EditAlbumModal'
import { assetUrl } from '../../utils/assetUrl'

// AlbumsSection Component
function AlbumsSection() {
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
        <div className="mt-4 px-2">
            <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
                <div className="flex items-center gap-1">
                    <Folder size={12} />
                    <span>Albums</span>
                </div>
                <button
                    onClick={() => setShowNewInput(!showNewInput)}
                    className="hover:text-white"
                    title="Create Album"
                >
                    <Plus size={14} />
                </button>
            </div>

            {showNewInput && (
                <div className="px-2 mb-2 flex gap-1">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        placeholder="Album name..."
                        className="flex-1 px-2 py-1 text-xs bg-[#1a1a1a] border border-[#333333] rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        autoFocus
                    />
                    <button onClick={handleCreate} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs">
                        Add
                    </button>
                </div>
            )}

            {albums.length === 0 ? (
                <div className="px-2 py-2 text-xs text-gray-500 text-center">
                    No albums yet
                </div>
            ) : (
                <div className="space-y-0.5">
                    {albums.map((album) => (
                        <div
                            key={album.id}
                            className={`group relative flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${dragOverAlbumId === album.id ? 'bg-blue-600/50 border border-blue-500' :
                                viewMode === 'album' && selectedAlbumId === album.id
                                    ? 'bg-green-600 text-white'
                                    : 'text-gray-300 hover:bg-[#333333] border border-transparent'
                                }`}
                            onClick={() => showAlbum(album.id)}
                            onDragOver={(e) => handleDragOver(e, album.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, album.id)}
                        >
                            <div className="w-6 h-6 rounded bg-gray-700 overflow-hidden flex-shrink-0">
                                {album.cover_path ? (
                                    <img
                                        src={assetUrl(album.cover_path)}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                        <Folder size={12} />
                                    </div>
                                )}
                            </div>
                            <span className="flex-1 text-sm truncate">{album.name}</span>
                            <span className={`text-xs ${viewMode === 'album' && selectedAlbumId === album.id ? 'text-green-200' : 'text-gray-500'}`}>
                                {album.photo_count ?? 0}
                            </span>

                            {/* Context menu trigger */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setMenuOpenId(menuOpenId === album.id ? null : album.id)
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-600 rounded"
                            >
                                <MoreHorizontal size={14} />
                            </button>

                            {/* Context menu */}
                            {menuOpenId === album.id && (
                                <div
                                    ref={menuRef}
                                    className="absolute right-0 top-full mt-1 z-10 bg-gray-800 border border-gray-700 rounded shadow-lg py-1 min-w-[140px]"
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            startAddingToAlbum(album.id)
                                            setMenuOpenId(null)
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700 w-full text-left"
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
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700 w-full text-left"
                                    >
                                        <Pencil size={12} />
                                        Edit Album
                                    </button>
                                    <div className="border-t border-gray-700 my-1" />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            deleteAlbum(album.id)
                                            setMenuOpenId(null)
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 w-full text-left"
                                    >
                                        <Trash2 size={12} />
                                        Delete Album
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

// PeopleAlbumsSection - Shows named people as smart albums
function PeopleAlbumsSection({ onSelectPerson }: { onSelectPerson: (personId: number) => void }) {
    const { viewMode } = useLibraryStore()
    const [people, setPeople] = useState<(PersonRecord & { face_count: number })[]>([])
    const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        loadPeople()
    }, [])

    const loadPeople = async () => {
        setIsLoading(true)
        try {
            const allPeople = await window.api.getAllPeople()
            // Only show named people
            setPeople(allPeople.filter(p => p.name && p.name.trim() !== ''))
        } catch (error) {
            console.error('Failed to load people:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSelectPerson = (personId: number) => {
        setSelectedPersonId(personId)
        // Don't call showPeople() - we want to stay in Library view
        onSelectPerson(personId)
    }

    if (people.length === 0 && !isLoading) return null

    return (
        <div className="mt-4 px-2">
            <div className="flex items-center px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
                <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
                <span>People Albums</span>
                {isLoading && <Loader2 size={10} className="ml-2 animate-spin" />}
            </div>

            <div className="space-y-0.5">
                {people.map((person) => (
                    <button
                        key={person.id}
                        onClick={() => handleSelectPerson(person.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-left transition-colors ${viewMode === 'people' && selectedPersonId === person.id
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-300 hover:bg-[#333333]'
                            }`}
                    >
                        {/* Avatar with initial */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${viewMode === 'people' && selectedPersonId === person.id
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-600 text-gray-300'
                            }`}>
                            {person.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <span className="flex-1 text-sm truncate">{person.name}</span>
                        <span className={`text-xs ${viewMode === 'people' && selectedPersonId === person.id
                            ? 'text-purple-200'
                            : 'text-gray-500'
                            }`}>
                            {person.face_count}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}

interface LibraryPanelProps {
    onSelectPerson?: (personId: number) => void
    onClearPerson?: () => void
}

export function LibraryPanel({ onSelectPerson, onClearPerson }: LibraryPanelProps) {
    const {
        images,
        stats,
        isImporting,
        importProgress,
        tags,
        searchQuery,
        searchResults,
        isSearching,
        viewMode,
        loadStats,
        loadTags,
        importFolder,
        search,
        clearSearch,
        filterByTag,
        showAllPhotos,
        showPeople,
        showDuplicates,
    } = useLibraryStore()

    const [localQuery, setLocalQuery] = useState('')
    const [showAllTags, setShowAllTags] = useState(false)

    // Setup progress listener and load initial data
    useEffect(() => {
        const cleanup = setupLibraryProgressListener()
        loadStats()
        loadTags()
        showAllPhotos()
        return cleanup
    }, [loadStats, loadTags, showAllPhotos])

    // Handle import folder action
    const handleImportFolder = async () => {
        const path = await window.api.selectFolder()
        if (path) {
            await importFolder(path)
        }
    }

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localQuery.trim() && localQuery !== searchQuery) {
                search(localQuery)
            } else if (!localQuery.trim() && searchQuery) {
                clearSearch()
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [localQuery, search, clearSearch, searchQuery])

    // Handle search manual trigger (Enter key)
    const handleSearch = () => {
        if (localQuery.trim()) {
            search(localQuery)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    const handleClearSearch = () => {
        setLocalQuery('')
        clearSearch()
    }

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

    return (
        <div className="h-full w-full flex flex-col bg-[#252525] border-r border-[#333333]">
            {/* Header */}
            <div className="h-12 flex items-center px-4 border-b border-[#333333]">
                <span className="font-semibold text-sm text-gray-100 uppercase tracking-wide">Library</span>
            </div>

            {/* Search Bar */}
            <div className="p-2 border-b border-[#333333]">
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search images (e.g. 'sunset at beach')..."
                        value={localQuery}
                        onChange={(e) => setLocalQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full pl-8 pr-12 py-1.5 text-xs bg-[#1a1a1a] border border-[#333333] rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                    />
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none opacity-30" title="AI Search Active">
                        <Images size={12} className="text-blue-400" />
                    </div>
                    {(localQuery || searchQuery) && (
                        <button
                            onClick={handleClearSearch}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-white hover:bg-gray-600 rounded"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
                {isSearching && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-blue-400 px-2">
                        <Loader2 size={12} className="animate-spin" />
                        <span>Searching...</span>
                    </div>
                )}
                {!isSearching && searchQuery && searchResults.length === 0 && (viewMode === 'search' || viewMode === 'tag') && (
                    <div className="mt-1 text-xs text-orange-400 px-2">
                        No results found for "{searchQuery}"
                    </div>
                )}
                {!isSearching && searchResults.length > 0 && (viewMode === 'search' || viewMode === 'tag') && (
                    <div className="mt-1 text-xs text-green-400 px-2">
                        {searchResults.length} results for "{searchQuery}"
                    </div>
                )}
                {viewMode === 'library' && (
                    <div className="mt-1 text-xs text-blue-400 px-2">
                        Showing all {images.length} photos
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Collections Section */}
                <div className="p-2">
                    <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
                        <span>Collections</span>
                        <button
                            onClick={handleImportFolder}
                            className="hover:text-white disabled:opacity-50"
                            title="Import Folder to Library"
                            disabled={isImporting}
                        >
                            {isImporting ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <FolderInput size={14} />
                            )}
                        </button>
                    </div>

                    {/* Import Progress */}
                    {isImporting && importProgress && (
                        <div className="px-2 py-2 mb-2 text-xs bg-blue-500/20 border border-blue-500/30 rounded text-blue-300">
                            <div className="flex items-center gap-2">
                                <Loader2 size={12} className="animate-spin" />
                                <span>{getProgressMessage()}</span>
                            </div>
                            {importProgress.total > 0 && (
                                <div className="mt-1 h-1 bg-blue-500/30 rounded overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-300"
                                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* All Photos */}
                    <button
                        onClick={() => {
                            setLocalQuery('')
                            onClearPerson?.()
                            showAllPhotos()
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer text-left transition-colors ${viewMode === 'library' && !searchQuery
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-[#333333]'
                            }`}
                    >
                        <Images size={14} className={viewMode === 'library' && !searchQuery ? 'text-white' : 'text-gray-500'} />
                        <span>All Photos</span>
                        <span className={`ml-auto text-xs ${viewMode === 'library' && !searchQuery ? 'text-blue-200' : 'text-gray-500'}`}>{stats.totalImages}</span>
                    </button>

                    {/* Duplicates */}
                    {stats.duplicateGroups > 0 && (
                        <button
                            onClick={() => { onClearPerson?.(); showDuplicates() }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer text-left transition-colors ${viewMode === 'duplicates'
                                ? 'bg-orange-600 text-white'
                                : 'text-gray-300 hover:bg-[#333333]'
                                }`}
                        >
                            <Copy size={14} className={viewMode === 'duplicates' ? 'text-white' : 'text-orange-500'} />
                            <span>Duplicates</span>
                            <span className={`ml-auto text-xs ${viewMode === 'duplicates' ? 'text-orange-200' : 'text-orange-500'}`}>{stats.duplicateGroups}</span>
                        </button>
                    )}

                    {/* People */}
                    <button
                        onClick={() => { onClearPerson?.(); showPeople() }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer text-left transition-colors ${viewMode === 'people'
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-300 hover:bg-[#333333]'
                            }`}
                    >
                        <svg className={`w-3.5 h-3.5 ${viewMode === 'people' ? 'text-white' : 'text-purple-400'}`} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                        <span>People</span>
                        <span className={`ml-auto text-xs ${viewMode === 'people' ? 'text-purple-200' : 'text-purple-400'}`}>New</span>
                    </button>
                </div>

                {/* Albums Section */}
                <AlbumsSection />

                {/* People Albums Section */}
                {onSelectPerson && <PeopleAlbumsSection onSelectPerson={onSelectPerson} />}

                {/* Tags Section */}
                {tags.length > 0 && (
                    <div className="mt-4 px-2">
                        <div className="flex items-center px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
                            <Tag size={12} className="mr-1" />
                            <span>Tags</span>
                        </div>
                        <div className="flex flex-wrap gap-1 px-2">
                            {(showAllTags ? tags : tags.slice(0, 10)).map((tag) => (
                                <button
                                    key={tag.tag}
                                    onClick={() => {
                                        setLocalQuery(tag.tag)
                                        filterByTag(tag.tag)
                                    }}
                                    className={`px-2 py-0.5 text-xs rounded transition-colors ${viewMode === 'tag' && searchQuery === tag.tag
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-[#333333] hover:bg-[#444444] text-gray-300'
                                        }`}
                                >
                                    {tag.tag}
                                    <span className={`ml-1 ${viewMode === 'tag' && searchQuery === tag.tag ? 'text-blue-100' : 'text-gray-500'}`}>{tag.count}</span>
                                </button>
                            ))}
                        </div>
                        {tags.length > 10 && (
                            <button
                                onClick={() => setShowAllTags(!showAllTags)}
                                className="px-2 mt-1 text-xs text-blue-400 hover:text-blue-300"
                            >
                                {showAllTags ? 'Show less' : `+${tags.length - 10} more tags`}
                            </button>
                        )}
                    </div>
                )}

            </div>
        </div>
    )
}

