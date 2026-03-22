import { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef, type WheelEvent, type MouseEvent } from 'react'
import { ZoomIn, ZoomOut, Maximize, Square, Hand, Download } from 'lucide-react'
import { useCanvasProcessor } from '../../hooks/useCanvasProcessor'
import { ExportModal } from '../ExportModal'
import CropOverlay from '../tools/CropOverlay'
import { useUIStore, type CropRect } from '../../store/useUIStore'
import type { ImageAdjustments } from '../../../shared/types'
import { DEFAULT_IMAGE_ADJUSTMENTS } from '../../../shared/types'

export interface ImageViewerHandle {
    applyCrop: (rect: { x: number; y: number; w: number; h: number }) => void
    applyRotate90: () => void
    applyFlipH: () => void
    getDimensions: () => { width: number; height: number }
}

interface ImageViewerProps {
    src: string
    adjustments?: ImageAdjustments
    onHistogramChange?: (data: { r: number[]; g: number[]; b: number[]; lum: number[] } | null) => void
    onDimensionsChange?: (dims: { width: number; height: number }) => void
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const ZOOM_STEP = 0.25

export const ImageViewer = forwardRef<ImageViewerHandle, ImageViewerProps>(function ImageViewer({
    src,
    adjustments = DEFAULT_IMAGE_ADJUSTMENTS,
    onHistogramChange,
    onDimensionsChange
}, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const [zoom, setZoom] = useState(1)
    const [fitZoom, setFitZoom] = useState(1)
    const [isFitMode, setIsFitMode] = useState(true)

    // Hand tool state
    const [isHandToolActive, setIsHandToolActive] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 })
    const [isExportModalOpen, setIsExportModalOpen] = useState(false)

    // Tool and crop state from store
    const { cropState, setCropState, activeTool } = useUIStore()

    const handleCropChange = useCallback((rect: CropRect) => {
        setCropState({ rect })
    }, [setCropState])

    // Tool-based cursor for the canvas area
    const getToolCursor = useCallback(() => {
        if (isHandToolActive) return isDragging ? 'grabbing' : 'grab'
        switch (activeTool) {
            case 'crop': return 'crosshair'
            case 'brush': return 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'1.5\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'8\'/%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'1\' fill=\'white\'/%3E%3C/svg%3E") 12 12, crosshair'
            case 'eraser': return 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'1.5\'%3E%3Crect x=\'4\' y=\'4\' width=\'16\' height=\'16\' rx=\'2\'/%3E%3Cline x1=\'8\' y1=\'12\' x2=\'16\' y2=\'12\'/%3E%3C/svg%3E") 12 12, crosshair'
            case 'pen': return 'crosshair'
            case 'text': return 'text'
            case 'ai': return 'default'
            case 'select': return 'default'
            case 'layers': return 'default'
            default: return 'default'
        }
    }, [activeTool, isHandToolActive, isDragging])

    // Canvas processor hook
    const {
        canvasRef,
        isLoading,
        error,
        dimensions,
        histogram,
        showOriginal,
        showProcessed,
        isShowingOriginal,
        getCanvasDataUrl,
        applyCrop,
        applyRotate90,
        applyFlipH
    } = useCanvasProcessor({
        src,
        adjustments
    })

    // Expose imperative methods for crop/rotate/flip
    useImperativeHandle(ref, () => ({
        applyCrop,
        applyRotate90,
        applyFlipH,
        getDimensions: () => dimensions,
    }), [applyCrop, applyRotate90, applyFlipH, dimensions])

    // Propagate histogram changes to parent
    useEffect(() => {
        onHistogramChange?.(histogram)
    }, [histogram, onHistogramChange])

    // Propagate dimension changes to parent
    useEffect(() => {
        if (dimensions.width > 0) {
            onDimensionsChange?.(dimensions)
        }
    }, [dimensions, onDimensionsChange])

    const { width: naturalWidth, height: naturalHeight } = dimensions

    // Compute numeric aspect ratio for CropOverlay (after dimensions is available)
    const cropAspectRatio = (() => {
        const ar = cropState.aspectRatio
        if (ar === 'freeform') return null
        if (ar === '16:9') return 16 / 9
        if (ar === '4:5') return 4 / 5
        if (ar === '1:1') return 1
        if (ar === 'original' && naturalWidth > 0) return naturalWidth / naturalHeight
        return null
    })()

    // Calculate fit zoom based on container and image dimensions
    const calculateFitZoom = useCallback(() => {
        if (!containerRef.current || naturalWidth === 0) return 1

        const container = containerRef.current.getBoundingClientRect()
        const padding = 32 // 16px padding on each side

        const scaleX = (container.width - padding) / naturalWidth
        const scaleY = (container.height - padding) / naturalHeight

        // Fit to container but never scale above 100%
        return Math.min(scaleX, scaleY, 1)
    }, [naturalWidth, naturalHeight])

    // Update fit zoom when container resizes or image loads
    useEffect(() => {
        if (naturalWidth === 0) return

        const newFitZoom = calculateFitZoom()
        setFitZoom(newFitZoom)

        if (isFitMode) {
            setZoom(newFitZoom)
        }
    }, [naturalWidth, naturalHeight, calculateFitZoom, isFitMode])

    // Watch container resize
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const resizeObserver = new ResizeObserver(() => {
            const newFitZoom = calculateFitZoom()
            setFitZoom(newFitZoom)

            if (isFitMode) {
                setZoom(newFitZoom)
            }
        })

        resizeObserver.observe(container)
        return () => resizeObserver.disconnect()
    }, [calculateFitZoom, isFitMode])

    // Reset when src changes
    useEffect(() => {
        setIsFitMode(true)
    }, [src])

    // Zoom with constraints
    const applyZoom = useCallback((newZoom: number, centerOnMouse = false, mouseX = 0, mouseY = 0) => {
        const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom))

        // Get scroll position before zoom
        const scrollContainer = scrollContainerRef.current
        if (scrollContainer && centerOnMouse) {
            const rect = scrollContainer.getBoundingClientRect()
            const scrollX = scrollContainer.scrollLeft
            const scrollY = scrollContainer.scrollTop

            // Calculate relative position in the scrollable area
            const relX = (mouseX - rect.left + scrollX) / zoom
            const relY = (mouseY - rect.top + scrollY) / zoom

            // Apply new zoom
            setZoom(clampedZoom)
            setIsFitMode(false)

            // Scroll to keep mouse position centered after zoom
            requestAnimationFrame(() => {
                const newScrollX = relX * clampedZoom - (mouseX - rect.left)
                const newScrollY = relY * clampedZoom - (mouseY - rect.top)
                scrollContainer.scrollLeft = newScrollX
                scrollContainer.scrollTop = newScrollY
            })
        } else {
            setZoom(clampedZoom)
            setIsFitMode(false)
        }
    }, [zoom])

    // Mouse wheel zoom (Ctrl/Cmd + scroll)
    const handleWheel = useCallback((e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return

        e.preventDefault()
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
        applyZoom(zoom + delta, true, e.clientX, e.clientY)
    }, [zoom, applyZoom])

    // Toolbar actions
    const zoomIn = () => applyZoom(zoom + ZOOM_STEP)
    const zoomOut = () => applyZoom(zoom - ZOOM_STEP)

    const fitToView = () => {
        setZoom(fitZoom)
        setIsFitMode(true)
        // Center the scroll
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = 0
            scrollContainerRef.current.scrollTop = 0
        }
    }

    const actualSize = () => {
        setZoom(1)
        setIsFitMode(false)
        // Center the image in scroll container
        if (scrollContainerRef.current && containerRef.current) {
            const container = containerRef.current.getBoundingClientRect()
            const scrollContainer = scrollContainerRef.current
            scrollContainer.scrollLeft = Math.max(0, (naturalWidth - container.width) / 2)
            scrollContainer.scrollTop = Math.max(0, (naturalHeight - container.height) / 2)
        }
    }

    // Double-click to toggle fit/100%
    const handleDoubleClick = () => {
        if (isFitMode) {
            actualSize()
        } else {
            fitToView()
        }
    }

    // Hand tool drag handlers
    const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
        if (!isHandToolActive) return
        e.preventDefault()
        setIsDragging(true)
        setDragStart({ x: e.clientX, y: e.clientY })
        if (scrollContainerRef.current) {
            setScrollStart({
                x: scrollContainerRef.current.scrollLeft,
                y: scrollContainerRef.current.scrollTop
            })
        }
    }, [isHandToolActive])

    const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
        if (!isDragging || !scrollContainerRef.current) return
        e.preventDefault()
        const deltaX = e.clientX - dragStart.x
        const deltaY = e.clientY - dragStart.y
        scrollContainerRef.current.scrollLeft = scrollStart.x - deltaX
        scrollContainerRef.current.scrollTop = scrollStart.y - deltaY
    }, [isDragging, dragStart, scrollStart])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    const handleMouseLeave = useCallback(() => {
        setIsDragging(false)
    }, [])

    // Toggle hand tool
    const toggleHandTool = () => {
        setIsHandToolActive(!isHandToolActive)
    }

    // Determine cursor for scroll container
    const getContainerCursor = () => {
        return getToolCursor()
    }

    const handleExportClick = () => {
        setIsExportModalOpen(true)
    }

    const zoomPercent = Math.round(zoom * 100)
    const scaledWidth = naturalWidth * zoom
    const scaledHeight = naturalHeight * zoom

    // Hold-to-compare handlers (on canvas, not affected by hand tool)
    const handleCanvasMouseDown = useCallback(() => {
        if (!isHandToolActive) {
            showOriginal()
        }
    }, [isHandToolActive, showOriginal])

    const handleCanvasMouseUp = useCallback(() => {
        showProcessed()
    }, [showProcessed])

    const handleCanvasMouseLeave = useCallback(() => {
        if (isShowingOriginal) {
            showProcessed()
        }
    }, [isShowingOriginal, showProcessed])

    return (
        <div ref={containerRef} className="h-full w-full flex flex-col bg-gray-200 dark:bg-[#1e1e1e] overflow-hidden">
            {/* Zoom Toolbar */}
            <div className="h-8 flex-shrink-0 flex items-center justify-center gap-2 bg-gray-100 dark:bg-[#1a1a1a] border-b border-gray-300 dark:border-[#333333] text-xs">
                <button
                    onClick={zoomOut}
                    disabled={zoom <= MIN_ZOOM}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-[#333333] rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Zoom Out (-)"
                >
                    <ZoomOut size={14} />
                </button>
                <span className="w-12 text-center text-gray-700 dark:text-gray-400 select-none">{zoomPercent}%</span>
                <button
                    onClick={zoomIn}
                    disabled={zoom >= MAX_ZOOM}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-[#333333] rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Zoom In (+)"
                >
                    <ZoomIn size={14} />
                </button>
                <div className="w-px h-4 bg-gray-300 dark:bg-[#333333] mx-1" />
                <button
                    onClick={fitToView}
                    className={`p-1 hover:bg-gray-200 dark:hover:bg-[#333333] rounded ${isFitMode ? 'bg-gray-300 dark:bg-[#444444]' : ''}`}
                    title="Fit to View"
                >
                    <Maximize size={14} />
                </button>
                <button
                    onClick={actualSize}
                    className={`p-1 hover:bg-gray-200 dark:hover:bg-[#333333] rounded ${zoom === 1 && !isFitMode ? 'bg-gray-300 dark:bg-[#444444]' : ''}`}
                    title="Actual Size (100%)"
                >
                    <Square size={14} />
                </button>
                <div className="w-px h-4 bg-gray-300 dark:bg-[#333333] mx-1" />
                <button
                    onClick={toggleHandTool}
                    className={`p-1 hover:bg-gray-200 dark:hover:bg-[#333333] rounded ${isHandToolActive ? 'bg-gray-300 dark:bg-[#444444]' : ''}`}
                    title="Hand Tool (Pan)"
                >
                    <Hand size={14} />
                </button>
                <div className="w-px h-4 bg-gray-300 dark:bg-[#333333] mx-1" />
                <button
                    onClick={handleExportClick}
                    disabled={isLoading || !!error}
                    className="p-1 hover:bg-[#333333] rounded disabled:opacity-30 disabled:cursor-not-allowed text-green-400 hover:text-green-300"
                    title="Export Image"
                >
                    <Download size={14} />
                </button>
            </div>

            {/* Scrollable Canvas Container */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-auto"
                onWheel={handleWheel}
                onDoubleClick={handleDoubleClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--sb-color)',
                    cursor: getContainerCursor(),
                } as any}
            >
                {/* Loading State */}
                {isLoading && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-gray-600 dark:text-gray-500">Loading...</div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-red-600 dark:text-red-500">{error}</div>
                    </div>
                )}

                {/* Canvas Container */}
                {!isLoading && !error && (
                    <div
                        className="flex items-center justify-center"
                        style={{
                            minWidth: '100%',
                            minHeight: '100%',
                            width: scaledWidth > 0 ? Math.max(scaledWidth + 32, 0) : '100%',
                            height: scaledHeight > 0 ? Math.max(scaledHeight + 32, 0) : '100%',
                            padding: '16px',
                        }}
                    >
                        <div className="relative">
                            <canvas
                                ref={canvasRef}
                                className="shadow-2xl select-none"
                                onMouseDown={handleCanvasMouseDown}
                                onMouseUp={handleCanvasMouseUp}
                                onMouseLeave={handleCanvasMouseLeave}
                                style={{
                                    width: scaledWidth || 'auto',
                                    height: scaledHeight || 'auto',
                                    maxWidth: 'none',
                                    maxHeight: 'none',
                                    pointerEvents: isHandToolActive ? 'none' : 'auto',
                                }}
                            />
                            {/* Crop overlay */}
                            {cropState.active && scaledWidth > 0 && scaledHeight > 0 && (
                                <CropOverlay
                                    width={scaledWidth}
                                    height={scaledHeight}
                                    cropRect={cropState.rect}
                                    onCropChange={handleCropChange}
                                    aspectRatio={cropAspectRatio}
                                />
                            )}
                            {/* Original indicator overlay */}
                            {isShowingOriginal && (
                                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                    Original
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Export Modal */}
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                originalFileName={src}
                getCanvasDataUrl={getCanvasDataUrl}
            />
        </div>
    )
})
