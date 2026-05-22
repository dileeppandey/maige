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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-[#2a2a2a] rounded-lg shadow-xl w-[400px] max-w-[90vw]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#333333]">
                    <h2 className="text-sm font-medium text-white flex items-center gap-2">
                        <Download size={16} />
                        Export Image
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-[#333333] rounded text-gray-400 hover:text-white"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Format Selection */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-2">Format</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFormat('jpeg')}
                                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${format === 'jpeg'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-[#333333] text-gray-300 hover:bg-[#404040]'
                                    }`}
                            >
                                JPEG
                            </button>
                            <button
                                onClick={() => setFormat('png')}
                                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${format === 'png'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-[#333333] text-gray-300 hover:bg-[#404040]'
                                    }`}
                            >
                                PNG
                            </button>
                        </div>
                    </div>

                    {/* Quality Slider (JPEG only) */}
                    {format === 'jpeg' && (
                        <div>
                            <label className="block text-xs text-gray-400 mb-2">
                                Quality: {quality}%
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                value={quality}
                                onChange={(e) => setQuality(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    )}

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-xs">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-2 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-xs">
                            {success}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="px-4 py-3 border-t border-[#333333] flex gap-2">
                    <button
                        onClick={() => handleExport(false)}
                        disabled={isExporting}
                        className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
                    >
                        {isExporting ? 'Exporting...' : 'Save As...'}
                    </button>
                    <button
                        onClick={() => handleExport(true)}
                        disabled={isExporting}
                        className="flex-1 py-2 px-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
                        title="Overwrite original file"
                    >
                        Overwrite
                    </button>
                </div>
            </div>
        </div>
    )
}
