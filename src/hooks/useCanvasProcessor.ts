import { useState, useRef, useEffect, useCallback } from 'react'
import { ImageProcessor } from '../processing/ImageProcessor'
import type { ImageAdjustments } from '../../shared/types'

interface UseCanvasProcessorOptions {
    src: string | null
    adjustments: ImageAdjustments
}

interface UseCanvasProcessorReturn {
    canvasRef: React.RefObject<HTMLCanvasElement | null>
    isLoading: boolean
    error: string | null
    dimensions: { width: number; height: number }
    histogram: { r: number[]; g: number[]; b: number[]; lum: number[] } | null
    showOriginal: () => void
    showProcessed: () => void
    isShowingOriginal: boolean
    getCanvasDataUrl: (format?: 'image/jpeg' | 'image/png', quality?: number) => string | null
    applyCrop: (rect: { x: number; y: number; w: number; h: number }) => void
    applyRotate90: () => void
    applyFlipH: () => void
}

/**
 * Hook for managing canvas-based image processing
 * Loads image, applies adjustments, and renders to canvas
 */
export function useCanvasProcessor({
    src,
    adjustments
}: UseCanvasProcessorOptions): UseCanvasProcessorReturn {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const processorRef = useRef<ImageProcessor | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
    const [histogram, setHistogram] = useState<{ r: number[]; g: number[]; b: number[]; lum: number[] } | null>(null)
    const [isShowingOriginal, setIsShowingOriginal] = useState(false)

    // Store current adjustments for restoration
    const currentAdjustmentsRef = useRef(adjustments)
    currentAdjustmentsRef.current = adjustments

    // Debounce timer for processing
    const processTimerRef = useRef<number | null>(null)

    // Load image when src changes
    useEffect(() => {
        if (!src) {
            processorRef.current = null
            setDimensions({ width: 0, height: 0 })
            setHistogram(null)
            return
        }

        const loadImage = async () => {
            setIsLoading(true)
            setError(null)

            try {
                const processor = new ImageProcessor()
                await processor.loadImage(src)
                processorRef.current = processor
                setDimensions(processor.getDimensions())
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load image')
                processorRef.current = null
            } finally {
                setIsLoading(false)
            }
        }

        loadImage()

        return () => {
            if (processTimerRef.current) {
                cancelAnimationFrame(processTimerRef.current)
            }
        }
    }, [src])

    // Process image when adjustments change
    useEffect(() => {
        const processor = processorRef.current
        const canvas = canvasRef.current

        if (!processor || !processor.isLoaded() || !canvas || isShowingOriginal) {
            return
        }

        // Cancel any pending processing
        if (processTimerRef.current) {
            cancelAnimationFrame(processTimerRef.current)
        }

        // Debounce processing for performance
        processTimerRef.current = requestAnimationFrame(() => {
            processor.processToCanvas(adjustments, canvas)

            // Update histogram (less frequently for performance)
            const hist = processor.generateHistogram(adjustments)
            setHistogram(hist)
        })

        return () => {
            if (processTimerRef.current) {
                cancelAnimationFrame(processTimerRef.current)
            }
        }
    }, [adjustments, isShowingOriginal])

    // Initial render when loading completes
    // Use requestAnimationFrame to ensure the canvas DOM element is available
    // (it's conditionally rendered based on isLoading)
    useEffect(() => {
        if (isLoading) return

        const processor = processorRef.current
        if (!processor || !processor.isLoaded()) return

        const renderToCanvas = () => {
            const canvas = canvasRef.current
            if (!canvas) return
            processor.processToCanvas(adjustments, canvas)
            const hist = processor.generateHistogram(adjustments)
            setHistogram(hist)
        }

        // Canvas may not be in DOM yet since it's conditionally rendered on !isLoading.
        // Wait one frame for React to commit the DOM update.
        const frameId = requestAnimationFrame(renderToCanvas)
        return () => cancelAnimationFrame(frameId)
    }, [isLoading, adjustments])

    // Show original (unprocessed) image
    const showOriginal = useCallback(() => {
        const processor = processorRef.current
        const canvas = canvasRef.current

        if (!processor || !processor.isLoaded() || !canvas) return

        setIsShowingOriginal(true)
        processor.renderOriginal(canvas)
    }, [])

    // Show processed image
    const showProcessed = useCallback(() => {
        const processor = processorRef.current
        const canvas = canvasRef.current

        if (!processor || !processor.isLoaded() || !canvas) return

        setIsShowingOriginal(false)
        processor.processToCanvas(currentAdjustmentsRef.current, canvas)
    }, [])

    // Get canvas as data URL for export
    const getCanvasDataUrl = useCallback((format: 'image/jpeg' | 'image/png' = 'image/jpeg', quality = 0.9): string | null => {
        const canvas = canvasRef.current
        if (!canvas) return null
        return canvas.toDataURL(format, quality)
    }, [])

    // Crop the original image and re-render
    const applyCrop = useCallback((rect: { x: number; y: number; w: number; h: number }) => {
        const processor = processorRef.current
        const canvas = canvasRef.current
        if (!processor || !processor.isLoaded() || !canvas) return

        processor.cropOriginal(rect)
        setDimensions(processor.getDimensions())
        processor.processToCanvas(currentAdjustmentsRef.current, canvas)
        setHistogram(processor.generateHistogram(currentAdjustmentsRef.current))
    }, [])

    // Rotate the original image 90° clockwise and re-render
    const applyRotate90 = useCallback(() => {
        const processor = processorRef.current
        const canvas = canvasRef.current
        if (!processor || !processor.isLoaded() || !canvas) return

        processor.rotateOriginal90()
        setDimensions(processor.getDimensions())
        processor.processToCanvas(currentAdjustmentsRef.current, canvas)
        setHistogram(processor.generateHistogram(currentAdjustmentsRef.current))
    }, [])

    // Flip the original image horizontally and re-render
    const applyFlipH = useCallback(() => {
        const processor = processorRef.current
        const canvas = canvasRef.current
        if (!processor || !processor.isLoaded() || !canvas) return

        processor.flipOriginalH()
        processor.processToCanvas(currentAdjustmentsRef.current, canvas)
    }, [])

    return {
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
    }
}
