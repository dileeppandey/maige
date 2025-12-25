import type { FileInfo } from '../../../shared/types'
import { FolderOpen } from 'lucide-react'

interface LibraryPanelProps {
    currentPath: string | null
    files: FileInfo[]
    onOpenFolder: () => void
}

export function LibraryPanel({ currentPath, files, onOpenFolder }: LibraryPanelProps) {
    return (
        <div className="h-full w-full flex flex-col bg-[#252525] border-r border-[#333333]">
            {/* Header */}
            <div className="h-12 flex items-center px-4 border-b border-[#333333]">
                <span className="font-semibold text-sm text-gray-100 uppercase tracking-wide">Library</span>
            </div>

            {/* Folders Section */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                    <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
                        <span>Folders</span>
                        <button onClick={onOpenFolder} className="hover:text-white" title="Open Folder">
                            <FolderOpen size={14} />
                        </button>
                    </div>

                    {currentPath ? (
                        <div className="px-2 py-1 text-sm bg-[#333333] rounded text-gray-200 truncate" title={currentPath}>
                            {currentPath.split(/[/\\]/).pop()}
                        </div>
                    ) : (
                        <div className="px-4 py-8 text-center text-xs text-gray-500">
                            No folder open
                        </div>
                    )}
                </div>

                {/* File List (Vertical) - simplified for now */}
                <div className="mt-4 px-2">
                    <div className="flex items-center px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
                        <span>Catalog</span>
                    </div>
                    <div className="text-xs px-2 text-gray-500">
                        {files.length} images found
                    </div>
                </div>
            </div>
        </div>
    )
}
