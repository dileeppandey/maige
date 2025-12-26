import { useEffect, useState } from 'react'
import type { FileInfo } from '../../../shared/types'
import { FolderOpen, Images, Copy, Loader2, Search, Tag, X } from 'lucide-react'
import { useLibraryStore, setupLibraryProgressListener } from '../../store/useLibraryStore'

interface LibraryPanelProps {
    currentPath: string | null
    files: FileInfo[]
    onOpenFolder: () => void
}

export function LibraryPanel({ currentPath, files, onOpenFolder }: LibraryPanelProps) {
    const {
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
    } = useLibraryStore()

    const [localQuery, setLocalQuery] = useState('')
    const [showAllTags, setShowAllTags] = useState(false)

    // Setup progress listener and load initial data
    useEffect(() => {
        const cleanup = setupLibraryProgressListener()
        loadStats()
        loadTags()
        return cleanup
    }, [loadStats, loadTags])

    // Handle import folder action
    const handleImportFolder = async () => {
        const path = await window.electronAPI.selectFolder()
        if (path) {
            await importFolder(path)
        }
    }

    // Handle search
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
                        placeholder="Search images..."
                        value={localQuery}
                        onChange={(e) => setLocalQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full pl-8 pr-8 py-1.5 text-sm bg-[#1a1a1a] border border-[#333333] rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
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
                    <div className="flex items-center gap-2 mt-1 text-xs text-blue-400">
                        <Loader2 size={12} className="animate-spin" />
                        <span>Searching...</span>
                    </div>
                )}
                {searchResults.length > 0 && viewMode !== 'library' && (
                    <div className="mt-1 text-xs text-green-400">
                        {searchResults.length} results for "{searchQuery}"
                    </div>
                )}
                {viewMode === 'library' && (
                    <div className="mt-1 text-xs text-blue-400">
                        Showing all {searchResults.length} photos
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Folders Section */}
                <div className="p-2">
                    <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
                        <span>Folders</span>
                        <button onClick={onOpenFolder} className="hover:text-white" title="Open Folder">
                            <FolderOpen size={14} />
                        </button>
                    </div>

                    {currentPath ? (
                        <div className="px-2 py-1 text-sm bg-[#333333] rounded text-gray-200 truncate" title={currentPath}>
                            {currentPath.split(/[/\\]/).pop()}
                        </div>
                    ) : (
                        <div className="px-4 py-8 text-center text-xs text-gray-500">
                            No folder open
                        </div>
                    )}
                </div>

                {/* Smart Collections Section */}
                <div className="mt-4 px-2">
                    <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
                        <span>Smart Collections</span>
                        <button
                            onClick={handleImportFolder}
                            className="hover:text-white disabled:opacity-50"
                            title="Import Folder to Library"
                            disabled={isImporting}
                        >
                            {isImporting ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <FolderOpen size={14} />
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
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-300 hover:bg-[#333333] rounded cursor-pointer">
                            <Copy size={14} className="text-orange-500" />
                            <span>Duplicates</span>
                            <span className="ml-auto text-xs text-orange-500">{stats.duplicateGroups}</span>
                        </div>
                    )}
                </div>

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

                {/* Current Folder Stats */}
                <div className="mt-4 px-2">
                    <div className="flex items-center px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
                        <span>Current Folder</span>
                    </div>
                    <div className="text-xs px-2 text-gray-500">
                        {files.length} images in view
                    </div>
                </div>
            </div>
        </div>
    )
}

