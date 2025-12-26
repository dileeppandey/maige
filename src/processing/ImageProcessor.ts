import type { ImageAdjustments } from '../../shared/types'

/**
 * Clamp a value to 0-255 range
 */
function clamp(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)))
}

/**
 * Calculate luminance of an RGB pixel (0-1 range)
 */
function getLuminance(r: number, g: number, b: number): number {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/**
 * Apply exposure adjustment using EV-style scaling
 * Value: -100 to 100 (0 = no change)
 */
function applyExposure(data: Uint8ClampedArray, value: number): void {
    if (value === 0) return
    const factor = Math.pow(2, value / 50) // More sensitive EV-style
    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(data[i] * factor)
        data[i + 1] = clamp(data[i + 1] * factor)
        data[i + 2] = clamp(data[i + 2] * factor)
    }
}

/**
 * Apply contrast adjustment using S-curve
 * Value: -100 to 100 (0 = no change)
 */
function applyContrast(data: Uint8ClampedArray, value: number): void {
    if (value === 0) return
    const factor = (259 * (value + 255)) / (255 * (259 - value))
    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(factor * (data[i] - 128) + 128)
        data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128)
        data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128)
    }
}

/**
 * Apply highlights adjustment (affects bright pixels)
 * Value: -100 to 100 (0 = no change)
 */
function applyHighlights(data: Uint8ClampedArray, value: number): void {
    if (value === 0) return
    const strength = value / 100
    for (let i = 0; i < data.length; i += 4) {
        const lum = getLuminance(data[i], data[i + 1], data[i + 2])
        // Only affect pixels above luminance threshold (0.5-1.0)
        if (lum > 0.5) {
            const weight = (lum - 0.5) * 2 // 0 at 0.5, 1 at 1.0
            const adjustment = 1 + strength * weight * 0.5
            data[i] = clamp(data[i] * adjustment)
            data[i + 1] = clamp(data[i + 1] * adjustment)
            data[i + 2] = clamp(data[i + 2] * adjustment)
        }
    }
}

/**
 * Apply shadows adjustment (affects dark pixels)
 * Value: -100 to 100 (0 = no change)
 */
function applyShadows(data: Uint8ClampedArray, value: number): void {
    if (value === 0) return
    const strength = value / 100
    for (let i = 0; i < data.length; i += 4) {
        const lum = getLuminance(data[i], data[i + 1], data[i + 2])
        // Only affect pixels below luminance threshold (0.0-0.5)
        if (lum < 0.5) {
            const weight = (0.5 - lum) * 2 // 1 at 0, 0 at 0.5
            const adjustment = 1 + strength * weight * 0.5
            data[i] = clamp(data[i] * adjustment)
            data[i + 1] = clamp(data[i + 1] * adjustment)
            data[i + 2] = clamp(data[i + 2] * adjustment)
        }
    }
}

/**
 * ImageProcessor - Canvas-based non-destructive image processing
 */
export class ImageProcessor {
    private originalCanvas: OffscreenCanvas | null = null
    private originalCtx: OffscreenCanvasRenderingContext2D | null = null
    private outputCanvas: OffscreenCanvas | null = null
    private outputCtx: OffscreenCanvasRenderingContext2D | null = null
    private width = 0
    private height = 0

    /**
     * Load an image and store original pixels
     */
    async loadImage(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'

            img.onload = () => {
                this.width = img.naturalWidth
                this.height = img.naturalHeight

                // Store original in OffscreenCanvas
                this.originalCanvas = new OffscreenCanvas(this.width, this.height)
                this.originalCtx = this.originalCanvas.getContext('2d')
                if (!this.originalCtx) {
                    reject(new Error('Failed to get 2D context'))
                    return
                }
                this.originalCtx.drawImage(img, 0, 0)

                // Create output canvas
                this.outputCanvas = new OffscreenCanvas(this.width, this.height)
                this.outputCtx = this.outputCanvas.getContext('2d')
                if (!this.outputCtx) {
                    reject(new Error('Failed to get 2D context for output'))
                    return
                }

                resolve()
            }

            img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
            img.src = src
        })
    }

    /**
     * Apply all adjustments and return processed ImageData
     */
    process(adjustments: ImageAdjustments): ImageData | null {
        if (!this.originalCtx || !this.outputCtx || !this.originalCanvas) {
            return null
        }

        // Get fresh copy of original pixels
        const imageData = this.originalCtx.getImageData(0, 0, this.width, this.height)
        const data = imageData.data

        // Apply light adjustments in order
        const { light } = adjustments
        applyExposure(data, light.exposure)
        applyContrast(data, light.contrast)
        applyHighlights(data, light.highlights)
        applyShadows(data, light.shadows)

        return imageData
    }

    /**
     * Process and draw to a target canvas
     */
    processToCanvas(adjustments: ImageAdjustments, targetCanvas: HTMLCanvasElement): void {
        const imageData = this.process(adjustments)
        if (!imageData) return

        targetCanvas.width = this.width
        targetCanvas.height = this.height
        const ctx = targetCanvas.getContext('2d')
        if (ctx) {
            ctx.putImageData(imageData, 0, 0)
        }
    }

    /**
     * Get dimensions of loaded image
     */
    getDimensions(): { width: number; height: number } {
        return { width: this.width, height: this.height }
    }

    /**
     * Check if an image is loaded
     */
    isLoaded(): boolean {
        return this.originalCanvas !== null
    }

    /**
     * Generate histogram data from current processed image
     */
    generateHistogram(adjustments: ImageAdjustments): { r: number[]; g: number[]; b: number[]; lum: number[] } {
        const r = new Array(256).fill(0)
        const g = new Array(256).fill(0)
        const b = new Array(256).fill(0)
        const lum = new Array(256).fill(0)

        const imageData = this.process(adjustments)
        if (!imageData) return { r, g, b, lum }

        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
            r[data[i]]++
            g[data[i + 1]]++
            b[data[i + 2]]++
            const l = Math.round(getLuminance(data[i], data[i + 1], data[i + 2]) * 255)
            lum[l]++
        }

        return { r, g, b, lum }
    }
}

// Singleton for current image (can be replaced with per-image instances)
export const imageProcessor = new ImageProcessor()
