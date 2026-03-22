import type { FileInfo } from '../../../shared/types'
import { useLibraryStore } from '../../store/useLibraryStore'
import { Check, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { assetUrl } from '../../utils/assetUrl'

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
        imageCacheVersion,
        addingToAlbumId,
        loadMore,
        hasMore,
        isSearching
    } = useLibraryStore()

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const loadMoreRef = useRef<HTMLDivElement>(null)
    const [isLoadingMore, setIsLoadingMore] = useState(false)

    // Helper to get image ID from file path
    const getImageId = useCallback((filePath: string): number | null => {
        const searchResult = searchResults.find(r => r.file_path === filePath)
        if (searchResult) return searchResult.id
        const image = images.find(i => i.file_path === filePath)
        return image?.id ?? null
    }, [searchResults, images])

    const handleClick = useCallback((file: FileInfo, event: React.MouseEvent) => {
        const imageId = getImageId(file.path)

        if ((event.metaKey || event.ctrlKey) && imageId !== null) {
            toggleImageSelection(imageId)
            return
        }

        onSelectFile(file)
    }, [getImageId, toggleImageSelection, onSelectFile])

    // Debounced load more
    useEffect(() => {
        if (!hasMore || isSearching || isLoadingMore || files.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isLoadingMore) {
                    setIsLoadingMore(true)
                    loadMore().finally(() => {
                        setTimeout(() => setIsLoadingMore(false), 500) // Debounce
                    })
                }
            },
            { threshold: 0.1, root: scrollContainerRef.current }
        )

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current)
        }

        return () => observer.disconnect()
    }, [hasMore, isSearching, loadMore, isLoadingMore, files.length])

    const currentAlbum = viewMode === 'album' && selectedAlbumId
        ? albums.find(a => a.id === selectedAlbumId)
        : null

    return (
        <div className="h-[120px] bg-gray-100 dark:bg-[#252525] border-t border-gray-300 dark:border-[#333333] flex flex-col">
            <div className="h-8 flex items-center justify-between px-3 bg-gray-50 dark:bg-[#1f1f1f] border-b border-gray-300 dark:border-[#333333] text-[11px] text-gray-600 dark:text-gray-500">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="flex-shrink-0">{currentAlbum ? `📁 ${currentAlbum.name}` : 'Filmstrip'}</span>
                    {currentAlbum?.description && (
                        <span className="text-gray-500 dark:text-gray-600 truncate" title={currentAlbum.description}>
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
                    <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">
                        {selectedImageIds.size} selected (⌘+Click to select)
                    </span>
                )}
                {selectedImageIds.size === 0 && (
                    <span className="text-gray-500 dark:text-gray-600 flex-shrink-0">
                        ⌘+Click to multi-select
                    </span>
                )}
            </div>
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-x-auto p-2 flex items-center gap-2"
            >
                {files.map((file) => {
                    const imageId = getImageId(file.path)
                    const isSelected = imageId !== null && selectedImageIds.has(imageId)
                    const isCurrentPreview = selectedFile?.path === file.path
                    const isInAlbum = imageId !== null && addingToAlbumId !== null && albumExistingImageIds.has(imageId)

                    return (
                        <div
                            key={file.path}
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
                                src={assetUrl(file.path, imageCacheVersion)}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />

                            {isInAlbum && (
                                <div className="absolute bottom-0 left-0 right-0 bg-green-600/90 text-white text-[8px] text-center py-0.5 font-medium">
                                    ✓ In Album
                                </div>
                            )}

                            {isSelected && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                                    <Check className="w-3 h-3 text-white" />
                                </div>
                            )}

                            {file.similarity !== undefined && (
                                <div className="absolute top-1 left-1 bg-blue-600/80 text-white text-[8px] px-1 rounded font-bold">
                                    {Math.round(file.similarity * 100)}%
                                </div>
                            )}

                            <div className={`absolute inset-0 transition-colors ${isSelected ? 'bg-blue-500/10' : 'bg-transparent group-hover:bg-white/5'}`}></div>
                        </div>
                    )
                })}

                {/* Loading indicator / Intersection element - only for paginated views */}
                {hasMore && viewMode !== 'cluster' && viewMode !== 'people' && viewMode !== 'album' && viewMode !== 'duplicates' && (
                    <div ref={loadMoreRef} className="flex-shrink-0 w-20 h-full flex items-center justify-center">
                        {isLoadingMore && (
                            <Loader2 className="w-5 h-5 text-gray-500 dark:text-gray-600 animate-spin" />
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
