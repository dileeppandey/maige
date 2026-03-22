import { useState, forwardRef } from 'react'
import type { FileInfo, ImageAdjustments } from '../../../shared/types'
import { Image as ImageIcon, Grid, ArrowLeft, Sparkles, Search, SlidersHorizontal, Calendar, Download } from 'lucide-react'
import { ImageViewer, type ImageViewerHandle } from '../viewer/ImageViewer'
import { GalleryGrid } from '../gallery/GalleryGrid'
import { AIBatchEditPanel } from '../panels/AIBatchEditPanel'
import { DEFAULT_IMAGE_ADJUSTMENTS } from '../../../shared/types'
import { useUIStore } from '../../store/useUIStore'
import { useLibraryStore } from '../../store/useLibraryStore'
import { assetUrl } from '../../utils/assetUrl'
import { Button, EmptyState } from '../../design-system'

type FilterTab = 'all' | 'edited' | 'raw' | 'ai_enhanced'

interface ImagePreviewProps {
    selectedFile: FileInfo | null
    adjustments?: ImageAdjustments
    onHistogramChange?: (data: { r: number[]; g: number[]; b: number[]; lum: number[] } | null) => void
    onDimensionsChange?: (dims: { width: number; height: number }) => void
    files?: FileInfo[]
    onSelectFile?: (file: FileInfo) => void
    totalPhotos?: number
}

export const ImagePreview = forwardRef<ImageViewerHandle, ImagePreviewProps>(function ImagePreview({
    selectedFile,
    adjustments = DEFAULT_IMAGE_ADJUSTMENTS,
    onHistogramChange,
    onDimensionsChange,
    files = [],
    onSelectFile = () => { },
    totalPhotos = 0
}, ref) {
    const { centerPanelMode, setCenterPanelMode } = useUIStore()
    const { imageCacheVersion, selectedImageIds, images, searchResults } = useLibraryStore()
    const [showBatchPanel, setShowBatchPanel] = useState(false)
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
    const [searchQuery, setSearchQuery] = useState('')

    const selectedCount = selectedImageIds.size

    // Build paths + ids for selected images (for AIBatchEditPanel)
    const selectedImageData = Array.from(selectedImageIds).map(id => {
        const img = images.find(i => i.id === id) ?? searchResults.find(r => r.id === id)
        return img ? { id, path: img.file_path } : null
    }).filter(Boolean) as { id: number; path: string }[]

    const filterTabs: { id: FilterTab; label: string }[] = [
        { id: 'all', label: 'All' },
        { id: 'edited', label: 'Edited' },
        { id: 'raw', label: 'RAW' },
        { id: 'ai_enhanced', label: 'AI Enhanced' },
    ]

    const handleImport = async () => {
        const path = await window.api.selectFolder()
        if (path) {
            useLibraryStore.getState().importFolder(path)
        }
    }

    // Show gallery grid when in grid mode
    if (centerPanelMode === 'grid') {
        return (
            <div className="flex-1 min-w-0 flex flex-col bg-surface-panel relative h-full overflow-hidden">
                {/* Top header bar */}
                <div className="h-10 flex items-center gap-3 px-4 bg-surface-raised border-b border-border-base flex-shrink-0">
                    <span className="text-sm font-semibold text-text-primary whitespace-nowrap">
                        All Photos
                    </span>
                    <span className="text-xs text-text-secondary whitespace-nowrap">
                        {totalPhotos.toLocaleString()} photos
                    </span>

                    {/* Search bar */}
                    <div className="flex-1 max-w-xs mx-2">
                        <div className="relative">
                            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search photos..."
                                className="w-full pl-7 pr-3 py-1 text-xs bg-surface-input border border-border-base rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-1 ml-auto">
                        <Button variant="ghost" size="sm" title="Filter">
                            <SlidersHorizontal size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" title="Date">
                            <Calendar size={14} />
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleImport}
                            leftIcon={<Download size={13} />}
                            className="ml-1"
                        >
                            Import
                        </Button>
                    </div>
                </div>

                {/* Filter tabs + selection info */}
                <div className="h-9 flex items-center justify-between px-4 bg-surface-panel border-b border-border-subtle flex-shrink-0">
                    <div className="flex items-center gap-0.5">
                        {filterTabs.map(tab => (
                            <Button
                                key={tab.id}
                                variant={activeFilter === tab.id ? 'primary' : 'secondary'}
                                size="xs"
                                onClick={() => setActiveFilter(tab.id)}
                                leftIcon={tab.id === 'ai_enhanced' ? <Sparkles size={12} /> : undefined}
                            >
                                {tab.label}
                            </Button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {selectedCount > 0 && (
                            <>
                                <span className="text-xs text-text-secondary">
                                    {selectedCount} selected
                                </span>
                                <Button
                                    variant="secondary"
                                    size="xs"
                                    onClick={() => setShowBatchPanel(true)}
                                    leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                                >
                                    AI Batch Edit
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <GalleryGrid files={files} onSelectFile={onSelectFile} />
                    {showBatchPanel && (
                        <AIBatchEditPanel
                            selectedImagePaths={selectedImageData.map(d => d.path)}
                            selectedImageIds={selectedImageData.map(d => d.id)}
                            onClose={() => setShowBatchPanel(false)}
                            onComplete={() => setShowBatchPanel(false)}
                        />
                    )}
                </div>
            </div>
        )
    }

    // Editor mode
    return (
        <div className="flex-1 min-w-0 flex flex-col bg-surface-panel relative h-full overflow-hidden">
            {/* Editor header bar */}
            <div className="h-10 flex items-center justify-between px-4 bg-surface-raised border-b border-border-base">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCenterPanelMode('grid')}
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                    Back to Gallery
                </Button>
                <span className="text-sm text-text-secondary truncate max-w-[300px]">
                    {selectedFile?.name || 'No image selected'}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCenterPanelMode('grid')}
                    leftIcon={<Grid className="w-4 h-4" />}
                >
                    Grid View
                </Button>
            </div>
            {selectedFile ? (
                <ImageViewer
                    ref={ref}
                    src={assetUrl(selectedFile.path, imageCacheVersion)}
                    adjustments={adjustments}
                    onHistogramChange={onHistogramChange}
                    onDimensionsChange={onDimensionsChange}
                />
            ) : (
                <EmptyState
                    icon={<ImageIcon size={48} />}
                    title="No image selected"
                    action={
                        <Button
                            variant="primary"
                            onClick={() => setCenterPanelMode('grid')}
                        >
                            Browse Gallery
                        </Button>
                    }
                />
            )}
        </div>
    )
})
