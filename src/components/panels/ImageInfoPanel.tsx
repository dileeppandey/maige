import { Image, Ruler, ZoomIn, Info } from 'lucide-react'

interface ImageInfoPanelProps {
    fileName?: string
    filePath?: string
    dimensions?: { width: number; height: number }
    zoomLevel?: number
}

export function ImageInfoPanel({ fileName, filePath, dimensions, zoomLevel }: ImageInfoPanelProps) {
    const folder = filePath ? filePath.split('/').slice(0, -1).join('/') : ''

    return (
        <div className="flex flex-col h-full bg-surface-panel">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 h-10 border-b border-border-base flex-shrink-0">
                <Info size={14} className="text-text-secondary" />
                <span className="text-sm font-semibold text-text-primary">Image Info</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {fileName ? (
                    <>
                        {/* File name */}
                        <div>
                            <div className="text-xs font-semibold text-text-secondary uppercase mb-2">File</div>
                            <div className="flex items-start gap-2">
                                <Image size={14} className="text-text-secondary mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <div className="text-sm text-text-primary break-all">{fileName}</div>
                                    {folder && (
                                        <div className="text-xs text-text-secondary break-all mt-1">{folder}</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Dimensions */}
                        {dimensions && dimensions.width > 0 && (
                            <div>
                                <div className="text-xs font-semibold text-text-secondary uppercase mb-2">Dimensions</div>
                                <div className="flex items-center gap-2">
                                    <Ruler size={14} className="text-text-secondary" />
                                    <span className="text-sm text-text-primary tabular-nums">
                                        {dimensions.width} × {dimensions.height} px
                                    </span>
                                </div>
                                <div className="text-xs text-text-secondary mt-1 ml-6">
                                    {(dimensions.width * dimensions.height / 1_000_000).toFixed(1)} MP
                                </div>
                            </div>
                        )}

                        {/* Zoom */}
                        {zoomLevel !== undefined && (
                            <div>
                                <div className="text-xs font-semibold text-text-secondary uppercase mb-2">View</div>
                                <div className="flex items-center gap-2">
                                    <ZoomIn size={14} className="text-text-secondary" />
                                    <span className="text-sm text-text-primary tabular-nums">{zoomLevel}%</span>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-sm text-text-secondary text-center mt-8">
                        No image selected
                    </div>
                )}
            </div>

            {/* Tip at bottom */}
            <div className="p-4 border-t border-border-base flex-shrink-0">
                <p className="text-xs text-text-secondary leading-relaxed">
                    Pan with click-drag. Zoom with scroll or Ctrl+scroll. Double-click to toggle fit/actual size.
                </p>
            </div>
        </div>
    )
}
