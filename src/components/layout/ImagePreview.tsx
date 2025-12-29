import type { FileInfo, ImageAdjustments } from '../../../shared/types'
import { Image as ImageIcon } from 'lucide-react'
import { ImageViewer } from '../viewer/ImageViewer'
import { DEFAULT_IMAGE_ADJUSTMENTS } from '../../../shared/types'

interface ImagePreviewProps {
    selectedFile: FileInfo | null
    adjustments?: ImageAdjustments
    onHistogramChange?: (data: { r: number[]; g: number[]; b: number[]; lum: number[] } | null) => void
}

export function ImagePreview({ selectedFile, adjustments = DEFAULT_IMAGE_ADJUSTMENTS, onHistogramChange }: ImagePreviewProps) {
    return (
        <div className="flex-1 min-w-0 flex flex-col bg-[#1e1e1e] relative h-full overflow-hidden">
            {selectedFile ? (
                <ImageViewer
                    src={`media://${selectedFile.path}`}
                    adjustments={adjustments}
                    onHistogramChange={onHistogramChange}
                />
            ) : (
                <div className="flex-1 flex items-center justify-center text-gray-600">
                    <div className="text-center">
                        <ImageIcon size={48} className="mx-auto mb-2 opacity-20" />
                        <p>No image selected</p>
                    </div>
                </div>
            )}
        </div>
    )
}
