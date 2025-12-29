import type { FileInfo } from '../../../shared/types'
import { useLibraryStore } from '../../store/useLibraryStore'
import { Check } from 'lucide-react'

interface FilmstripProps {
    files: FileInfo[]
    selectedFile: FileInfo | null
    onSelectFile: (file: FileInfo) => void
}

export function Filmstrip({ files, selectedFile, onSelectFile }: FilmstripProps) {
    const { selectedImageIds, toggleImageSelection, images, searchResults, albumExistingImageIds } = useLibraryStore()

    // Helper to get image ID from file path
    const getImageId = (filePath: string): number | null => {
        // Try search results first (they have id)
        const searchResult = searchResults.find(r => r.file_path === filePath)
        if (searchResult) return searchResult.id

        // Try images array
        const image = images.find(i => i.file_path === filePath)
        return image?.id ?? null
    }

    const handleClick = (file: FileInfo, event: React.MouseEvent) => {
        const imageId = getImageId(file.path)

        // CMD/CTRL + Click for multi-select
        if ((event.metaKey || event.ctrlKey) && imageId !== null) {
            toggleImageSelection(imageId)
            return
        }

        // Normal click - select file for preview
        onSelectFile(file)
    }

    // Get current album name if viewing an album
    const { viewMode, selectedAlbumId, albums, startAddingToAlbum, addingToAlbumId } = useLibraryStore()
    const currentAlbum = viewMode === 'album' && selectedAlbumId
        ? albums.find(a => a.id === selectedAlbumId)
        : null

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
            <div className="flex-1 overflow-x-auto p-2 flex items-center gap-2">
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

                                // Ideally, we drag all selected items if the dragged item is selected
                                let idsToDrag: number[] = [];

                                if (isSelected) {
                                    // If dragging a selected item, drag ALL selected items
                                    idsToDrag = Array.from(selectedImageIds);
                                } else {
                                    // If dragging an unselected item, just drag that one
                                    idsToDrag = [imageId];
                                }

                                e.dataTransfer.setData('application/json', JSON.stringify({ imageIds: idsToDrag }));
                                e.dataTransfer.effectAllowed = 'copy';

                                // Add a nice drag image
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
                })}
            </div>
        </div>
    )
}
