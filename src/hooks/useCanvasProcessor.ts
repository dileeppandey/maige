import { useState, useRef, useEffect } from 'react'
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

        if (!processor || !processor.isLoaded() || !canvas) {
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
    }, [adjustments])

    // Initial render when loading completes
    useEffect(() => {
        const processor = processorRef.current
        const canvas = canvasRef.current

        if (!isLoading && processor && processor.isLoaded() && canvas) {
            processor.processToCanvas(adjustments, canvas)
            const hist = processor.generateHistogram(adjustments)
            setHistogram(hist)
        }
    }, [isLoading, adjustments])

    return {
        canvasRef,
        isLoading,
        error,
        dimensions,
        histogram
    }
}
