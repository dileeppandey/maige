import { useState } from 'react'
import { X, Download } from 'lucide-react'
import { useLibraryStore } from '../store/useLibraryStore'
import type { ImageAdjustments } from '../../shared/types'
import { DEFAULT_COLOR_ADJUSTMENTS } from '../../shared/types'

interface ExportModalProps {
    isOpen: boolean
    onClose: () => void
    imagePath: string
    adjustments: ImageAdjustments
}

export function ExportModal({
    isOpen,
    onClose,
    imagePath,
    adjustments
}: ExportModalProps) {
    const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg')
    const [quality, setQuality] = useState(90)
    const [isExporting, setIsExporting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const { invalidateImageCache } = useLibraryStore()

    if (!isOpen) return null

    const handleExport = async (overwrite: boolean) => {
        setError(null)
        setSuccess(null)
        setIsExporting(true)

        try {
            let outputPath: string | null

            if (overwrite) {
                outputPath = imagePath
            } else {
                const baseName = imagePath.replace(/\.[^.]+$/, '')
                const extension = format === 'jpeg' ? 'jpg' : 'png'
                const defaultPath = `${baseName}_edited.${extension}`
                outputPath = await window.api.showExportSaveDialog(defaultPath, format)
            }

            if (!outputPath) {
                setIsExporting(false)
                return
            }

            const result = await window.api.exportImage({
                sourcePath: imagePath,
                outputPath,
                adjustments: {
                    light: adjustments.light,
                    color: adjustments.color ?? DEFAULT_COLOR_ADJUSTMENTS,
                },
                format,
                quality,
            })

            if (result.success) {
                invalidateImageCache()
                setSuccess(`Saved to: ${result.path}`)
                setTimeout(() => { onClose() }, 1500)
            } else {
                setError(result.error || 'Export failed')
            }
        } catch (err) {
            setError(String(err))
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl w-[380px] max-w-[90vw]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
                    <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                        <Download size={15} />
                        Export Image
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a] transition-colors"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    {/* Format Selection */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Format</label>
                        <div className="flex gap-2">
                            {(['jpeg', 'png'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFormat(f)}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors border ${format === f
                                        ? 'border-blue-500 bg-blue-600/10 text-blue-400'
                                        : 'border-[#333] bg-[#252525] text-gray-400 hover:border-[#555] hover:text-gray-200'
                                    }`}
                                >
                                    {f.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quality Slider (JPEG only) */}
                    {format === 'jpeg' && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-medium text-gray-400">Quality</label>
                                <span className="text-xs text-gray-400">{quality}%</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                value={quality}
                                onChange={(e) => setQuality(Number(e.target.value))}
                                className="w-full accent-blue-500"
                            />
                        </div>
                    )}

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-2.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-xs">
                            {success}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-[#2a2a2a] bg-[#191919] rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleExport(true)}
                            disabled={isExporting}
                            className="px-3.5 py-1.5 border border-[#444] bg-[#252525] hover:border-[#666] hover:text-gray-200 disabled:opacity-40 text-gray-400 rounded-lg text-xs font-medium transition-colors"
                            title="Overwrite original file"
                        >
                            Overwrite
                        </button>
                        <button
                            onClick={() => handleExport(false)}
                            disabled={isExporting}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                            {isExporting ? 'Saving…' : 'Save As…'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
