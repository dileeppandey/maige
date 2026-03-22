import { useRef, useEffect, useMemo } from 'react'

interface HistogramProps {
    histogramData: {
        r: number[]
        g: number[]
        b: number[]
        lum: number[]
    } | null
}

/**
 * Histogram component - displays RGB and luminance distribution
 */
export function Histogram({ histogramData }: HistogramProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Normalize histogram data for display
    const normalizedData = useMemo(() => {
        if (!histogramData) return null

        const { r, g, b, lum } = histogramData

        // Find max value across all channels for normalization
        const maxVal = Math.max(
            ...r.slice(5, 250), // Ignore extreme ends
            ...g.slice(5, 250),
            ...b.slice(5, 250),
            ...lum.slice(5, 250)
        )

        if (maxVal === 0) return null

        return {
            r: r.map(v => v / maxVal),
            g: g.map(v => v / maxVal),
            b: b.map(v => v / maxVal),
            lum: lum.map(v => v / maxVal)
        }
    }, [histogramData])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !normalizedData) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const width = canvas.width
        const height = canvas.height
        const barWidth = width / 256

        // Clear canvas - detect theme from DOM
        const isDark = document.documentElement.classList.contains('dark')
        ctx.fillStyle = isDark ? '#1a1a1a' : '#f3f4f6'
        ctx.fillRect(0, 0, width, height)

        // Draw luminance (white, behind)
        ctx.globalAlpha = 0.3
        ctx.fillStyle = '#888888'
        for (let i = 0; i < 256; i++) {
            const barHeight = normalizedData.lum[i] * height
            ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight)
        }

        // Draw RGB channels with blending
        ctx.globalCompositeOperation = 'screen'
        ctx.globalAlpha = 0.7

        // Red channel
        ctx.fillStyle = '#ff4444'
        for (let i = 0; i < 256; i++) {
            const barHeight = normalizedData.r[i] * height
            ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight)
        }

        // Green channel
        ctx.fillStyle = '#44ff44'
        for (let i = 0; i < 256; i++) {
            const barHeight = normalizedData.g[i] * height
            ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight)
        }

        // Blue channel
        ctx.fillStyle = '#4488ff'
        for (let i = 0; i < 256; i++) {
            const barHeight = normalizedData.b[i] * height
            ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight)
        }

        // Reset composite operation
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1

    }, [normalizedData])

    if (!histogramData) {
        return (
            <div className="h-32 bg-gray-100 dark:bg-[#1a1a1a] rounded mb-6 border border-gray-200 dark:border-[#333333] flex items-center justify-center text-xs text-gray-600 dark:text-gray-600">
                No image selected
            </div>
        )
    }

    return (
        <div className="h-32 bg-gray-100 dark:bg-[#1a1a1a] rounded mb-6 border border-gray-200 dark:border-[#333333] overflow-hidden">
            <canvas
                ref={canvasRef}
                width={256}
                height={128}
                className="w-full h-full"
                style={{ imageRendering: 'pixelated' }}
            />
        </div>
    )
}
