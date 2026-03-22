import { useCallback, useMemo } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import { useLibraryStore } from '../../store/useLibraryStore'
import { useUIStore } from '../../store/useUIStore'
import { Check, Loader2, Images } from 'lucide-react'
import type { FileInfo } from '../../../shared/types'
import { assetUrl } from '../../utils/assetUrl'
import { EmptyState } from '../../design-system'

interface GalleryGridProps {
    files: FileInfo[]
    onSelectFile: (file: FileInfo) => void
}

export function GalleryGrid({ files, onSelectFile }: GalleryGridProps) {
    const {
        selectedImageIds,
        toggleImageSelection,
        images,
        searchResults,
        albumExistingImageIds,
        addingToAlbumId,
        loadMore,
        hasMore,
        isSearching,
        viewMode,
        imageCacheVersion
    } = useLibraryStore()

    const { setCenterPanelMode } = useUIStore()

    // Helper to get image ID from file path
    const getImageId = useCallback((filePath: string): number | null => {
        const searchResult = searchResults.find(r => r.file_path === filePath)
        if (searchResult) return searchResult.id
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

        // Normal click - select file and switch to editor mode
        onSelectFile(file)
        setCenterPanelMode('editor')
    }, [getImageId, toggleImageSelection, onSelectFile, setCenterPanelMode])

    const handleEndReached = useCallback(() => {
        if (hasMore && !isSearching) {
            loadMore()
        }
    }, [hasMore, isSearching, loadMore])

    // Render grid item
    const ItemContent = useCallback((index: number) => {
        const file = files[index]
        if (!file) return null

        const imageId = getImageId(file.path)
        const isSelected = imageId !== null && selectedImageIds.has(imageId)
        const isInAlbum = imageId !== null && addingToAlbumId !== null && albumExistingImageIds.has(imageId)

        return (
            <div
                onClick={(e) => handleClick(file, e)}
                className={`
                    aspect-square rounded-lg overflow-hidden cursor-pointer relative group
                    border-2 transition-all duration-150
                    ${isInAlbum
                        ? 'border-green-500/50 opacity-60'
                        : isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500/50'
                            : 'border-transparent hover:border-gray-500'
                    }
                `}
            >
                <img
                    src={assetUrl(file.path, imageCacheVersion)}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    alt={file.name}
                />

                {/* Selection checkbox */}
                {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                        <Check className="w-4 h-4 text-white" />
                    </div>
                )}

                {/* In album indicator */}
                {isInAlbum && (
                    <div className="absolute bottom-0 left-0 right-0 bg-green-600/90 text-white text-[10px] text-center py-1 font-medium">
                        ✓ In Album
                    </div>
                )}

                {/* Hover overlay with filename */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                    <div className="w-full px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs truncate">{file.name}</p>
                    </div>
                </div>
            </div>
        )
    }, [files, getImageId, selectedImageIds, addingToAlbumId, albumExistingImageIds, handleClick])

    // Footer with loading indicator - only show for paginated views
    const Footer = useMemo(() => {
        // Don't show loader for views without pagination
        if (!hasMore || viewMode === 'cluster' || viewMode === 'people' || viewMode === 'album' || viewMode === 'duplicates') return null
        return (
            <div className="col-span-full flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
            </div>
        )
    }, [hasMore, viewMode])

    if (files.length === 0) {
        return (
            <EmptyState
                icon={<Images size={40} />}
                title="No photos to display"
                description="Import a folder to get started"
            />
        )
    }

    return (
        <div className="flex-1 h-full overflow-hidden bg-gray-100 dark:bg-[#1a1a1a] p-4">
            <VirtuosoGrid
                style={{ height: '100%' }}
                totalCount={files.length}
                overscan={50}
                itemContent={ItemContent}
                endReached={handleEndReached}
                listClassName="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2"
                itemClassName=""
                components={{
                    Footer: () => Footer
                }}
            />
        </div>
    )
}
