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
 * Apply whites adjustment (affects very bright pixels, shifting white point)
 * Value: -100 to 100
 */
function applyWhites(data: Uint8ClampedArray, value: number): void {
    if (value === 0) return
    const strength = value / 100
    for (let i = 0; i < data.length; i += 4) {
        const lum = getLuminance(data[i], data[i + 1], data[i + 2])
        if (lum > 0.8) { // Affect top 20%
            const weight = (lum - 0.8) * 5
            const factor = 1 + (strength * weight * 0.2) // Subtle boost
            data[i] = clamp(data[i] * factor)
            data[i + 1] = clamp(data[i + 1] * factor)
            data[i + 2] = clamp(data[i + 2] * factor)
        }
    }
}

/**
 * Apply blacks adjustment (affects very dark pixels, shifting black point)
 * Value: -100 to 100
 */
function applyBlacks(data: Uint8ClampedArray, value: number): void {
    if (value === 0) return
    const strength = value / 100
    for (let i = 0; i < data.length; i += 4) {
        const lum = getLuminance(data[i], data[i + 1], data[i + 2])
        if (lum < 0.2) { // Affect bottom 20%
            const weight = (0.2 - lum) * 5
            const factor = 1 + (strength * weight * 0.2)
            // For blacks, positive value should brighten (lift blacks), negative should darken
            data[i] = clamp(data[i] * factor)
            data[i + 1] = clamp(data[i + 1] * factor)
            data[i + 2] = clamp(data[i + 2] * factor)
        }
    }
}

/**
 * Apply temperature and tint
 * Temp: -100 (Blue) to 100 (Yellow)
 * Tint: -100 (Green) to 100 (Magenta)
 */
function applyTemperatureTint(data: Uint8ClampedArray, temp: number, tint: number): void {
    if (temp === 0 && tint === 0) return

    // Temp: Blue <-> Yellow. Adjust Red and Blue channels.
    // +Temp = More Red, Less Blue
    const rScale = 1 + (temp / 100) * 0.2
    const bScale = 1 - (temp / 100) * 0.2

    // Tint: Green <-> Magenta. Adjust Green channel.
    // +Tint = Magenta (Less Green)
    // -Tint = Green (More Green)
    const gScale = 1 - (tint / 100) * 0.2

    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(data[i] * rScale)
        data[i + 1] = clamp(data[i + 1] * gScale)
        data[i + 2] = clamp(data[i + 2] * bScale)
    }
}

/**
 * Apply Saturation and Vibrance
 * Saturation: Linear multiplier on chroma
 * Vibrance: Smart saturation (boosts muted colors more than saturated ones)
 */
function applySaturationVibrance(data: Uint8ClampedArray, sat: number, vib: number): void {
    if (sat === 0 && vib === 0) return

    const satMult = 1 + (sat / 100)

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const range = max - min

        // Skip greys
        if (range === 0) continue

        const currentSat = range / (max + min) // Simplified saturation estimate

        // Vibrance factor: Apply less if already saturated
        // If currentSat is high, vibFactor closes to 1 (no change) from vibrance
        // If currentSat is low, vibFactor applies full vibrance
        const vFactor = 1 + (vib / 100) * (1 - currentSat)

        // Combined global saturation and dynamic vibrance
        const factor = satMult * vFactor

        if (factor === 1) continue

        // Lerp towards luminance (greyscale) or away from it
        // A simple implementation of saturation is adjusting distance from luminance
        // NewColor = Lum + (Color - Lum) * Factor
        const gray = getLuminance(r, g, b) * 255

        data[i] = clamp(gray + (r - gray) * factor)
        data[i + 1] = clamp(gray + (g - gray) * factor)
        data[i + 2] = clamp(gray + (b - gray) * factor)
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
        // Fetch as blob to avoid CORS issues with Tauri's asset protocol,
        // then create a same-origin object URL for canvas pixel access.
        const response = await fetch(src)
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${src} (${response.status})`)
        }
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)

        try {
            await new Promise<void>((resolve, reject) => {
                const img = new Image()

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
                img.src = objectUrl
            })
        } finally {
            URL.revokeObjectURL(objectUrl)
        }
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
        applyWhites(data, light.whites)
        applyBlacks(data, light.blacks)

        // Apply color adjustments
        const { color } = adjustments
        if (color) {
            applyTemperatureTint(data, color.temperature, color.tint)
            applySaturationVibrance(data, color.saturation, color.vibrance)
        }

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
     * Crop the original image data to the given normalized rect.
     * This is destructive — replaces the original with the cropped version.
     */
    cropOriginal(rect: { x: number; y: number; w: number; h: number }): void {
        if (!this.originalCtx || !this.originalCanvas) return

        const sx = Math.round(rect.x * this.width)
        const sy = Math.round(rect.y * this.height)
        const sw = Math.round(rect.w * this.width)
        const sh = Math.round(rect.h * this.height)

        if (sw <= 0 || sh <= 0) return

        const croppedData = this.originalCtx.getImageData(sx, sy, sw, sh)

        this.width = sw
        this.height = sh

        this.originalCanvas = new OffscreenCanvas(sw, sh)
        this.originalCtx = this.originalCanvas.getContext('2d')
        if (this.originalCtx) {
            this.originalCtx.putImageData(croppedData, 0, 0)
        }

        this.outputCanvas = new OffscreenCanvas(sw, sh)
        this.outputCtx = this.outputCanvas.getContext('2d')
    }

    /**
     * Rotate the original image by 90 degrees clockwise.
     * Destructive — replaces original.
     */
    rotateOriginal90(): void {
        if (!this.originalCtx || !this.originalCanvas) return

        const imageData = this.originalCtx.getImageData(0, 0, this.width, this.height)
        const newW = this.height
        const newH = this.width

        const newCanvas = new OffscreenCanvas(newW, newH)
        const newCtx = newCanvas.getContext('2d')
        if (!newCtx) return

        // Draw rotated
        newCtx.translate(newW, 0)
        newCtx.rotate(Math.PI / 2)
        // Put original data on a temp canvas to use drawImage
        const tempCanvas = new OffscreenCanvas(this.width, this.height)
        const tempCtx = tempCanvas.getContext('2d')
        if (!tempCtx) return
        tempCtx.putImageData(imageData, 0, 0)
        newCtx.drawImage(tempCanvas, 0, 0)

        this.width = newW
        this.height = newH
        this.originalCanvas = newCanvas
        this.originalCtx = newCtx
        this.outputCanvas = new OffscreenCanvas(newW, newH)
        this.outputCtx = this.outputCanvas.getContext('2d')
    }

    /**
     * Flip the original image horizontally.
     * Destructive — replaces original.
     */
    flipOriginalH(): void {
        if (!this.originalCtx || !this.originalCanvas) return

        const imageData = this.originalCtx.getImageData(0, 0, this.width, this.height)
        const newCanvas = new OffscreenCanvas(this.width, this.height)
        const newCtx = newCanvas.getContext('2d')
        if (!newCtx) return

        const tempCanvas = new OffscreenCanvas(this.width, this.height)
        const tempCtx = tempCanvas.getContext('2d')
        if (!tempCtx) return
        tempCtx.putImageData(imageData, 0, 0)

        newCtx.translate(this.width, 0)
        newCtx.scale(-1, 1)
        newCtx.drawImage(tempCanvas, 0, 0)

        this.originalCanvas = newCanvas
        this.originalCtx = newCtx
        this.outputCanvas = new OffscreenCanvas(this.width, this.height)
        this.outputCtx = this.outputCanvas.getContext('2d')
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
     * Render the original (unprocessed) image to a target canvas
     */
    renderOriginal(targetCanvas: HTMLCanvasElement): void {
        if (!this.originalCtx || !this.originalCanvas) return

        const imageData = this.originalCtx.getImageData(0, 0, this.width, this.height)

        targetCanvas.width = this.width
        targetCanvas.height = this.height
        const ctx = targetCanvas.getContext('2d')
        if (ctx) {
            ctx.putImageData(imageData, 0, 0)
        }
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
