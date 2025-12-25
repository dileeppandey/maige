import type { FileInfo } from '../../../shared/types'
import { Image as ImageIcon } from 'lucide-react'
import { ImageViewer } from '../viewer/ImageViewer'

interface ImagePreviewProps {
    selectedFile: FileInfo | null
}

export function ImagePreview({ selectedFile }: ImagePreviewProps) {
    return (
        <div className="flex-1 min-w-0 flex flex-col bg-[#1e1e1e] relative h-full overflow-hidden">
            {selectedFile ? (
                <ImageViewer
                    src={`media://${selectedFile.path}`}
                    alt={selectedFile.name}
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

