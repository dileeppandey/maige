import { RotateCw, FlipHorizontal, Check, X } from 'lucide-react'
import { useUIStore } from '../../store/useUIStore'

const ASPECT_RATIOS = [
    { label: 'Freeform', value: 'freeform' },
    { label: '16:9', value: '16:9' },
    { label: '4:5', value: '4:5' },
    { label: '1:1', value: '1:1' },
    { label: 'Original', value: 'original' },
] as const

interface CropToolbarProps {
    onApply: () => void
    onCancel: () => void
    onRotate: () => void
    onFlip: () => void
    imageDimensions?: { width: number; height: number }
}

export default function CropToolbar({ onApply, onCancel, onRotate, onFlip, imageDimensions }: CropToolbarProps) {
    const { cropState, setCropState } = useUIStore()

    const handleAspectRatioChange = (ratio: string) => {
        setCropState({ aspectRatio: ratio })

        if (ratio === 'freeform' || !imageDimensions || imageDimensions.width === 0) return

        // Target pixel aspect ratio
        let pixelAR: number | null = null
        if (ratio === '16:9') pixelAR = 16 / 9
        else if (ratio === '4:5') pixelAR = 4 / 5
        else if (ratio === '1:1') pixelAR = 1
        else if (ratio === 'original') pixelAR = imageDimensions.width / imageDimensions.height

        if (pixelAR == null) return

        // Convert pixel AR to normalized-space AR
        // In normalized coords: actual_pixel_w = rect.w * imgW, actual_pixel_h = rect.h * imgH
        // We want: (rect.w * imgW) / (rect.h * imgH) = pixelAR
        // So: rect.w / rect.h = pixelAR * imgH / imgW
        const normAR = (pixelAR * imageDimensions.height) / imageDimensions.width

        const { rect } = cropState
        const cx = rect.x + rect.w / 2
        const cy = rect.y + rect.h / 2

        let newW = rect.w
        let newH = rect.h
        const currentNormAR = rect.w / rect.h

        if (currentNormAR > normAR) {
            // Too wide, shrink width to match
            newW = rect.h * normAR
        } else {
            // Too tall, shrink height to match
            newH = rect.w / normAR
        }

        // Clamp to image bounds
        if (newW > 1) { newW = 1; newH = newW / normAR }
        if (newH > 1) { newH = 1; newW = newH * normAR }

        const newX = Math.max(0, Math.min(1 - newW, cx - newW / 2))
        const newY = Math.max(0, Math.min(1 - newH, cy - newH / 2))

        setCropState({ rect: { x: newX, y: newY, w: newW, h: newH } })
    }

    const handleRotate = () => {
        onRotate()
        // Reset crop rect after rotation since dimensions change
        setCropState({ rect: { x: 0, y: 0, w: 1, h: 1 }, aspectRatio: 'freeform' })
    }

    const handleFlip = () => {
        onFlip()
    }

    const cropW = imageDimensions ? Math.round(cropState.rect.w * imageDimensions.width) : 0
    const cropH = imageDimensions ? Math.round(cropState.rect.h * imageDimensions.height) : 0

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#1a1a1a]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-10 border-b border-gray-300 dark:border-[#333] flex-shrink-0">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Crop & Rotate</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Aspect Ratio */}
                <div>
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-3">Aspect Ratio</div>
                    <div className="flex flex-wrap gap-1.5">
                        {ASPECT_RATIOS.map((ratio) => (
                            <button
                                key={ratio.value}
                                onClick={() => handleAspectRatioChange(ratio.value)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                    cropState.aspectRatio === ratio.value
                                        ? 'bg-[#C8A951] text-[#1a1a1a]'
                                        : 'border border-gray-400 dark:border-[#444] text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:border-gray-600 dark:hover:border-[#666]'
                                }`}
                            >
                                {ratio.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Transform */}
                <div>
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-3">Transform</div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRotate}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#333] border border-gray-400 dark:border-[#444] transition-colors"
                        >
                            <RotateCw size={14} className="text-gray-600 dark:text-gray-400" />
                            Rotate 90°
                        </button>
                        <button
                            onClick={handleFlip}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#333] border border-gray-400 dark:border-[#444] transition-colors"
                        >
                            <FlipHorizontal size={14} />
                            Flip
                        </button>
                    </div>
                </div>

                {/* Crop Dimensions */}
                {imageDimensions && imageDimensions.width > 0 && (
                    <div>
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-3">Dimensions</div>
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#252525] rounded border border-gray-300 dark:border-[#333]">
                                <span className="text-gray-600 dark:text-gray-500">W</span>
                                <span className="text-gray-800 dark:text-gray-300 tabular-nums">{cropW}</span>
                            </div>
                            <span className="text-gray-600 dark:text-gray-600">×</span>
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#252525] rounded border border-gray-300 dark:border-[#333]">
                                <span className="text-gray-600 dark:text-gray-500">H</span>
                                <span className="text-gray-800 dark:text-gray-300 tabular-nums">{cropH}</span>
                            </div>
                            <span className="text-gray-600 dark:text-gray-600 ml-1">px</span>
                        </div>
                    </div>
                )}

            </div>

            {/* Apply / Cancel buttons at bottom */}
            <div className="flex items-center gap-2 p-4 border-t border-gray-300 dark:border-[#333] flex-shrink-0">
                <button
                    onClick={onCancel}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-gray-500 dark:border-[#555] text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#333] transition-colors"
                >
                    <X size={14} />
                    Cancel
                </button>
                <button
                    onClick={onApply}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#C8A951] text-[#1a1a1a] hover:bg-[#d4b55a] transition-colors"
                >
                    <Check size={14} />
                    Apply
                </button>
            </div>
        </div>
    )
}
