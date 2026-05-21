/**
 * useImageViewer — display-only canvas hook.
 *
 * Renders the image to a <canvas> for zoom/pan, and fetches histogram data
 * from the Rust backend (via `window.api.getHistogram`).
 *
 * All pixel-level processing (adjustments, histogram math) is done in Rust.
 * The canvas here is a display surface only.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ImageAdjustments } from '../../shared/types'
import { DEFAULT_IMAGE_ADJUSTMENTS } from '../../shared/types'

interface UseImageViewerOptions {
    src: string | null
    filePath?: string | null
    adjustments?: ImageAdjustments
}

interface UseImageViewerReturn {
    canvasRef: React.RefObject<HTMLCanvasElement | null>
    isLoading: boolean
    error: string | null
    dimensions: { width: number; height: number }
    histogram: { r: number[]; g: number[]; b: number[]; lum: number[] } | null
    showOriginal: () => void
    showProcessed: () => void
    isShowingOriginal: boolean
}

/**
 * Renders an image URL to a canvas element (display only — no pixel math).
 * Histogram data is fetched from the Rust backend when `filePath` is provided.
 */
export function useImageViewer({
    src,
    filePath,
    adjustments = DEFAULT_IMAGE_ADJUSTMENTS,
}: UseImageViewerOptions): UseImageViewerReturn {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const imgRef = useRef<HTMLImageElement | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
    const [histogram, setHistogram] = useState<{ r: number[]; g: number[]; b: number[]; lum: number[] } | null>(null)
    const [isShowingOriginal, setIsShowingOriginal] = useState(false)

    // Debounce timer for histogram requests
    const histTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Load and render the image to canvas whenever src changes
    useEffect(() => {
        if (!src) {
            imgRef.current = null
            setDimensions({ width: 0, height: 0 })
            setHistogram(null)
            return
        }

        setIsLoading(true)
        setError(null)

        const img = new Image()
        imgRef.current = img

        img.onload = () => {
            setDimensions({ width: img.naturalWidth, height: img.naturalHeight })
            renderToCanvas(img)
            setIsLoading(false)
        }

        img.onerror = () => {
            setError('Failed to load image')
            setIsLoading(false)
        }

        img.src = src

        return () => {
            img.onload = null
            img.onerror = null
        }
    }, [src])

    // Fetch histogram from Rust whenever adjustments or filePath change (debounced)
    useEffect(() => {
        if (!filePath) return

        if (histTimerRef.current) {
            clearTimeout(histTimerRef.current)
        }

        histTimerRef.current = setTimeout(async () => {
            try {
                const hist = await window.api.getHistogram(filePath, adjustments)
                if (hist) setHistogram(hist)
            } catch {
                // Histogram is non-critical — silently ignore errors
            }
        }, 150) // 150ms debounce

        return () => {
            if (histTimerRef.current) clearTimeout(histTimerRef.current)
        }
    }, [filePath, adjustments])

    const renderToCanvas = useCallback((img: HTMLImageElement) => {
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0)
    }, [])

    const showOriginal = useCallback(() => {
        setIsShowingOriginal(true)
        // Re-draw the unprocessed image.  The `src` URL already shows the
        // cached file on disk; the live-preview canvas filter is cleared.
        const canvas = canvasRef.current
        const img = imgRef.current
        if (canvas && img) {
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.filter = 'none'
                ctx.drawImage(img, 0, 0)
            }
        }
    }, [])

    const showProcessed = useCallback(() => {
        setIsShowingOriginal(false)
        const img = imgRef.current
        if (img) renderToCanvas(img)
    }, [renderToCanvas])

    return {
        canvasRef,
        isLoading,
        error,
        dimensions,
        histogram,
        showOriginal,
        showProcessed,
        isShowingOriginal,
    }
}
