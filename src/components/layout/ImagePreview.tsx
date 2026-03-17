import type { FileInfo, ImageAdjustments } from '../../../shared/types'
import { Image as ImageIcon, Grid, ArrowLeft } from 'lucide-react'
import { ImageViewer } from '../viewer/ImageViewer'
import { GalleryGrid } from '../gallery/GalleryGrid'
import { DEFAULT_IMAGE_ADJUSTMENTS } from '../../../shared/types'
import { useUIStore } from '../../store/useUIStore'
import { useLibraryStore } from '../../store/useLibraryStore'
import { assetUrl } from '../../utils/assetUrl'

interface ImagePreviewProps {
    selectedFile: FileInfo | null
    adjustments?: ImageAdjustments
    onHistogramChange?: (data: { r: number[]; g: number[]; b: number[]; lum: number[] } | null) => void
    files?: FileInfo[]
    onSelectFile?: (file: FileInfo) => void
    totalPhotos?: number
}

export function ImagePreview({
    selectedFile,
    adjustments = DEFAULT_IMAGE_ADJUSTMENTS,
    onHistogramChange,
    files = [],
    onSelectFile = () => { },
    totalPhotos = 0
}: ImagePreviewProps) {
    const { centerPanelMode, setCenterPanelMode } = useUIStore()
    const { imageCacheVersion } = useLibraryStore()

    // Show gallery grid when in grid mode and no file is being edited
    if (centerPanelMode === 'grid') {
        return (
            <div className="flex-1 min-w-0 flex flex-col bg-[#1e1e1e] relative h-full overflow-hidden">
                {/* Header with view toggle */}
                <div className="h-10 flex items-center justify-between px-4 bg-[#252525] border-b border-[#333]">
                    <span className="text-sm text-gray-400">
                        {totalPhotos} photos
                    </span>
                    <button
                        onClick={() => setCenterPanelMode('editor')}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors"
                    >
                        <ImageIcon className="w-4 h-4" />
                        Editor View
                    </button>
                </div>
                <GalleryGrid files={files} onSelectFile={onSelectFile} />
            </div>
        )
    }

    // Editor mode
    return (
        <div className="flex-1 min-w-0 flex flex-col bg-[#1e1e1e] relative h-full overflow-hidden">
            {/* Header with back button */}
            <div className="h-10 flex items-center justify-between px-4 bg-[#252525] border-b border-[#333]">
                <button
                    onClick={() => setCenterPanelMode('grid')}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Gallery
                </button>
                <span className="text-sm text-gray-400 truncate max-w-[200px]">
                    {selectedFile?.name || 'No image selected'}
                </span>
                <button
                    onClick={() => setCenterPanelMode('grid')}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors"
                >
                    <Grid className="w-4 h-4" />
                    Grid View
                </button>
            </div>
            {selectedFile ? (
                <ImageViewer
                    src={assetUrl(selectedFile.path, imageCacheVersion)}
                    adjustments={adjustments}
                    onHistogramChange={onHistogramChange}
                />
            ) : (
                <div className="flex-1 flex items-center justify-center text-gray-600">
                    <div className="text-center">
                        <ImageIcon size={48} className="mx-auto mb-2 opacity-20" />
                        <p>No image selected</p>
                        <button
                            onClick={() => setCenterPanelMode('grid')}
                            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                        >
                            Browse Gallery
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

