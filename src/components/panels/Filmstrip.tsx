import type { FileInfo } from '../../../shared/types'
import { useLibraryStore } from '../../store/useLibraryStore'
import { Check, Loader2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'

interface FilmstripProps {
    files: FileInfo[]
    selectedFile: FileInfo | null
    onSelectFile: (file: FileInfo) => void
}

export function Filmstrip({ files, selectedFile, onSelectFile }: FilmstripProps) {
    const {
        selectedImageIds,
        toggleImageSelection,
        images,
        searchResults,
        albumExistingImageIds,
        viewMode,
        selectedAlbumId,
        albums,
        startAddingToAlbum,
        addingToAlbumId,
        loadMore,
        hasMore,
        isSearching
    } = useLibraryStore()

    // Helper to get image ID from file path
    const getImageId = useCallback((filePath: string): number | null => {
        // Try search results first (they have id)
        const searchResult = searchResults.find(r => r.file_path === filePath)
        if (searchResult) return searchResult.id

        // Try images array
        const image = images.find(i => i.file_path === filePath)
        return image?.id ?? null
    }, [searchResults, images])

    const handleClick = useCallback((file: FileInfo, event: React.MouseEvent) => {
        const imageId = getImageId(file.path)

        // CMD/CTRL + Click for multi-select
        if ((event.metaKey || event.ctrlKey) && imageId !== null) {
            toggleImageSelection(imageId)
            return
        }

        // Normal click - select file for preview
        onSelectFile(file)
    }, [getImageId, toggleImageSelection, onSelectFile])

    const currentAlbum = viewMode === 'album' && selectedAlbumId
        ? albums.find(a => a.id === selectedAlbumId)
        : null

    // Memoized item content renderer
    const ItemContent = useCallback((index: number) => {
        const file = files[index]
        if (!file) return null

        const imageId = getImageId(file.path)
        const isSelected = imageId !== null && selectedImageIds.has(imageId)
        const isCurrentPreview = selectedFile?.path === file.path
        const isInAlbum = imageId !== null && addingToAlbumId !== null && albumExistingImageIds.has(imageId)

        return (
            <div
                draggable
                onDragStart={(e) => {
                    if (imageId === null) return;

                    let idsToDrag: number[] = [];
                    if (isSelected) {
                        idsToDrag = Array.from(selectedImageIds);
                    } else {
                        idsToDrag = [imageId];
                    }

                    e.dataTransfer.setData('application/json', JSON.stringify({ imageIds: idsToDrag }));
                    e.dataTransfer.effectAllowed = 'copy';

                    const dragIcon = document.createElement('div');
                    dragIcon.innerText = `${idsToDrag.length} Photos`;
                    dragIcon.style.background = '#2563eb';
                    dragIcon.style.color = 'white';
                    dragIcon.style.padding = '4px 8px';
                    dragIcon.style.borderRadius = '4px';
                    dragIcon.style.position = 'absolute';
                    dragIcon.style.top = '-1000px';
                    document.body.appendChild(dragIcon);
                    e.dataTransfer.setDragImage(dragIcon, 0, 0);
                    setTimeout(() => document.body.removeChild(dragIcon), 0);
                }}
                onClick={(e) => handleClick(file, e)}
                className={`
                    h-full aspect-[4/3] flex-shrink-0 border-2 rounded overflow-hidden cursor-pointer relative group
                    ${isInAlbum
                        ? 'border-green-500/50 opacity-60'
                        : isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500/50'
                            : isCurrentPreview
                                ? 'border-blue-500'
                                : 'border-transparent hover:border-gray-600'
                    }
                `}
            >
                <img
                    src={`media://${file.path}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />

                {/* "Already in album" indicator */}
                {isInAlbum && (
                    <div className="absolute bottom-0 left-0 right-0 bg-green-600/90 text-white text-[8px] text-center py-0.5 font-medium">
                        ✓ In Album
                    </div>
                )}

                {/* Selection checkbox overlay */}
                {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" />
                    </div>
                )}

                {/* Similarity badge */}
                {file.similarity !== undefined && (
                    <div className="absolute top-1 left-1 bg-blue-600/80 text-white text-[8px] px-1 rounded font-bold">
                        {Math.round(file.similarity * 100)}%
                    </div>
                )}

                {/* Hover overlay */}
                <div className={`absolute inset-0 transition-colors ${isSelected ? 'bg-blue-500/10' : 'bg-transparent group-hover:bg-white/5'}`}></div>
            </div>
        )
    }, [files, getImageId, selectedImageIds, selectedFile, addingToAlbumId, albumExistingImageIds, handleClick])

    // Footer component for the virtualized list
    const Footer = useMemo(() => {
        if (!hasMore) return null
        return (
            <div className="flex-shrink-0 w-20 h-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
            </div>
        )
    }, [hasMore])

    // Handle reaching end of list
    const handleEndReached = useCallback(() => {
        if (hasMore && !isSearching) {
            loadMore()
        }
    }, [hasMore, isSearching, loadMore])

    return (
        <div className="h-[120px] bg-[#252525] border-t border-[#333333] flex flex-col">
            <div className="h-8 flex items-center justify-between px-3 bg-[#1f1f1f] border-b border-[#333333] text-[11px] text-gray-500">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="flex-shrink-0">{currentAlbum ? `📁 ${currentAlbum.name}` : 'Filmstrip'}</span>
                    {currentAlbum?.description && (
                        <span className="text-gray-600 truncate" title={currentAlbum.description}>
                            — {currentAlbum.description}
                        </span>
                    )}
                    {currentAlbum && !addingToAlbumId && (
                        <button
                            onClick={() => startAddingToAlbum(currentAlbum.id)}
                            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-medium flex-shrink-0"
                        >
                            + Add Photos
                        </button>
                    )}
                </div>
                {selectedImageIds.size > 0 && (
                    <span className="text-blue-400 flex-shrink-0">
                        {selectedImageIds.size} selected (⌘+Click to select)
                    </span>
                )}
                {selectedImageIds.size === 0 && (
                    <span className="text-gray-600 flex-shrink-0">
                        ⌘+Click to multi-select
                    </span>
                )}
            </div>
            <div className="flex-1 overflow-hidden">
                <VirtuosoGrid
                    style={{ height: '100%' }}
                    totalCount={files.length}
                    overscan={20}
                    itemContent={ItemContent}
                    endReached={handleEndReached}
                    listClassName="flex items-center gap-2 p-2 h-full"
                    itemClassName="h-full"
                    components={{
                        Footer: () => Footer
                    }}
                />
            </div>
        </div>
    )
}
