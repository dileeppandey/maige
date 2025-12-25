import { useState, useRef, useCallback, useEffect, type WheelEvent } from 'react'
import { ZoomIn, ZoomOut, Maximize, Square } from 'lucide-react'

interface ImageViewerProps {
    src: string
    alt?: string
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const ZOOM_STEP = 0.25

export function ImageViewer({ src, alt = '' }: ImageViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const imageRef = useRef<HTMLImageElement>(null)

    const [zoom, setZoom] = useState(1)
    const [fitZoom, setFitZoom] = useState(1)
    const [isFitMode, setIsFitMode] = useState(true)
    const [imageLoaded, setImageLoaded] = useState(false)
    const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })

    // Calculate fit zoom based on container and image dimensions
    const calculateFitZoom = useCallback(() => {
        if (!containerRef.current || naturalSize.width === 0) return 1

        const container = containerRef.current.getBoundingClientRect()
        const padding = 32 // 16px padding on each side

        const scaleX = (container.width - padding) / naturalSize.width
        const scaleY = (container.height - padding) / naturalSize.height

        // Fit to container but never scale above 100%
        return Math.min(scaleX, scaleY, 1)
    }, [naturalSize])

    // Handle image load
    const handleImageLoad = useCallback(() => {
        if (!imageRef.current) return

        setNaturalSize({
            width: imageRef.current.naturalWidth,
            height: imageRef.current.naturalHeight
        })
        setImageLoaded(true)
    }, [])

    // Update fit zoom when container resizes or image loads
    useEffect(() => {
        if (!imageLoaded) return

        const newFitZoom = calculateFitZoom()
        setFitZoom(newFitZoom)

        if (isFitMode) {
            setZoom(newFitZoom)
        }
    }, [imageLoaded, naturalSize, calculateFitZoom, isFitMode])

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
        setImageLoaded(false)
        setNaturalSize({ width: 0, height: 0 })
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
            scrollContainer.scrollLeft = Math.max(0, (naturalSize.width - container.width) / 2)
            scrollContainer.scrollTop = Math.max(0, (naturalSize.height - container.height) / 2)
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

    const zoomPercent = Math.round(zoom * 100)
    const scaledWidth = naturalSize.width * zoom
    const scaledHeight = naturalSize.height * zoom

    return (
        <div ref={containerRef} className="h-full w-full flex flex-col bg-[#1e1e1e] overflow-hidden">
            {/* Zoom Toolbar */}
            <div className="h-8 flex-shrink-0 flex items-center justify-center gap-2 bg-[#1a1a1a] border-b border-[#333333] text-xs">
                <button
                    onClick={zoomOut}
                    disabled={zoom <= MIN_ZOOM}
                    className="p-1 hover:bg-[#333333] rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Zoom Out (-)"
                >
                    <ZoomOut size={14} />
                </button>
                <span className="w-12 text-center text-gray-400 select-none">{zoomPercent}%</span>
                <button
                    onClick={zoomIn}
                    disabled={zoom >= MAX_ZOOM}
                    className="p-1 hover:bg-[#333333] rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Zoom In (+)"
                >
                    <ZoomIn size={14} />
                </button>
                <div className="w-px h-4 bg-[#333333] mx-1" />
                <button
                    onClick={fitToView}
                    className={`p-1 hover:bg-[#333333] rounded ${isFitMode ? 'bg-[#444444]' : ''}`}
                    title="Fit to View"
                >
                    <Maximize size={14} />
                </button>
                <button
                    onClick={actualSize}
                    className={`p-1 hover:bg-[#333333] rounded ${zoom === 1 && !isFitMode ? 'bg-[#444444]' : ''}`}
                    title="Actual Size (100%)"
                >
                    <Square size={14} />
                </button>
            </div>

            {/* Scrollable Image Container - fixed size, scrolls internally */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-auto"
                onWheel={handleWheel}
                onDoubleClick={handleDoubleClick}
                style={{
                    // Custom scrollbar styling via inline for Electron
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#444444 #1a1a1a',
                }}
            >
                {/* Inner container that grows with zoomed image */}
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
                    <img
                        ref={imageRef}
                        src={src}
                        alt={alt}
                        onLoad={handleImageLoad}
                        draggable={false}
                        className="shadow-2xl select-none"
                        style={{
                            width: scaledWidth || 'auto',
                            height: scaledHeight || 'auto',
                            maxWidth: 'none',
                            maxHeight: 'none',
                            cursor: zoom > fitZoom ? 'grab' : 'default',
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
