import { useState } from 'react'
import { Download } from 'lucide-react'
import { useLibraryStore } from '../store/useLibraryStore'
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '../design-system'

interface ExportModalProps {
    isOpen: boolean
    onClose: () => void
    originalFileName: string
    getCanvasDataUrl: (format: 'image/jpeg' | 'image/png', quality: number) => string | null
}

export function ExportModal({
    isOpen,
    onClose,
    originalFileName,
    getCanvasDataUrl
}: ExportModalProps) {
    const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg')
    const [quality, setQuality] = useState(90)
    const [isExporting, setIsExporting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const { invalidateImageCache } = useLibraryStore()

    const handleExport = async (overwrite: boolean) => {
        setError(null)
        setSuccess(null)
        setIsExporting(true)

        try {
            // Get canvas data
            const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
            const dataUrl = getCanvasDataUrl(mimeType, quality / 100)

            if (!dataUrl) {
                setError('Failed to capture image data')
                setIsExporting(false)
                return
            }

            // Determine output path
            let outputPath: string | null

            if (overwrite) {
                // Use original path
                outputPath = originalFileName
            } else {
                // Show save dialog
                const baseName = originalFileName.replace(/\.[^.]+$/, '')
                const extension = format === 'jpeg' ? 'jpg' : 'png'
                const defaultPath = `${baseName}_edited.${extension}`

                outputPath = await window.api.showExportSaveDialog(defaultPath, format)
            }

            if (!outputPath) {
                setIsExporting(false)
                return // User cancelled
            }

            // Export image
            const result = await window.api.exportImage({
                dataUrl,
                outputPath,
                format,
                quality
            })

            if (result.success) {
                // Invalidate image cache so the updated image is shown
                invalidateImageCache()
                setSuccess(`Saved to: ${result.path}`)
                setTimeout(() => {
                    onClose()
                }, 1500)
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
        <Modal isOpen={isOpen} onClose={onClose} size="sm">
            <ModalHeader onClose={onClose} icon={<Download size={16} />}>Export Image</ModalHeader>
            <ModalBody className="space-y-4">
                    {/* Format Selection */}
                    <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">Format</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFormat('jpeg')}
                                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${format === 'jpeg'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[#404040]'
                                    }`}
                            >
                                JPEG
                            </button>
                            <button
                                onClick={() => setFormat('png')}
                                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${format === 'png'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[#404040]'
                                    }`}
                            >
                                PNG
                            </button>
                        </div>
                    </div>

                    {/* Quality Slider (JPEG only) */}
                    {format === 'jpeg' && (
                        <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
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
            </ModalBody>

            <ModalFooter>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleExport(false)}
                    disabled={isExporting}
                    loading={isExporting}
                >
                    {isExporting ? 'Exporting...' : 'Save As...'}
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExport(true)}
                    disabled={isExporting}
                    title="Overwrite original file"
                >
                    Overwrite
                </Button>
            </ModalFooter>
        </Modal>
    )
}
