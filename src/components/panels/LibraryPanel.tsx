import { useEffect } from 'react'
import type { FileInfo } from '../../../shared/types'
import { FolderOpen, Images, Copy, Loader2 } from 'lucide-react'
import { useLibraryStore, setupLibraryProgressListener } from '../../store/useLibraryStore'

interface LibraryPanelProps {
    currentPath: string | null
    files: FileInfo[]
    onOpenFolder: () => void
}

export function LibraryPanel({ currentPath, files, onOpenFolder }: LibraryPanelProps) {
    const { stats, isImporting, importProgress, loadStats, importFolder } = useLibraryStore()

    // Setup progress listener and load initial stats
    useEffect(() => {
        const cleanup = setupLibraryProgressListener()
        loadStats()
        return cleanup
    }, [loadStats])

    // Handle import folder action
    const handleImportFolder = async () => {
        const path = await window.electronAPI.selectFolder()
        if (path) {
            await importFolder(path)
        }
    }

    // Format progress message
    const getProgressMessage = () => {
        if (!importProgress) return ''
        switch (importProgress.phase) {
            case 'scanning':
                return 'Scanning folder...'
            case 'analyzing':
                return `Analyzing ${importProgress.current}/${importProgress.total}`
            case 'saving':
                return `Saving ${importProgress.current}/${importProgress.total}`
            case 'detecting_duplicates':
                return 'Detecting duplicates...'
            case 'complete':
                return 'Import complete!'
            default:
                return ''
        }
    }

    return (
        <div className="h-full w-full flex flex-col bg-[#252525] border-r border-[#333333]">
            {/* Header */}
            <div className="h-12 flex items-center px-4 border-b border-[#333333]">
                <span className="font-semibold text-sm text-gray-100 uppercase tracking-wide">Library</span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Folders Section */}
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

                {/* Smart Collections Section */}
                <div className="mt-4 px-2">
                    <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
                        <span>Smart Collections</span>
                        <button
                            onClick={handleImportFolder}
                            className="hover:text-white disabled:opacity-50"
                            title="Import Folder to Library"
                            disabled={isImporting}
                        >
                            {isImporting ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <FolderOpen size={14} />
                            )}
                        </button>
                    </div>

                    {/* Import Progress */}
                    {isImporting && importProgress && (
                        <div className="px-2 py-2 mb-2 text-xs bg-blue-500/20 border border-blue-500/30 rounded text-blue-300">
                            <div className="flex items-center gap-2">
                                <Loader2 size={12} className="animate-spin" />
                                <span>{getProgressMessage()}</span>
                            </div>
                            {importProgress.total > 0 && (
                                <div className="mt-1 h-1 bg-blue-500/30 rounded overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-300"
                                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* All Photos */}
                    <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-300 hover:bg-[#333333] rounded cursor-pointer">
                        <Images size={14} className="text-gray-500" />
                        <span>All Photos</span>
                        <span className="ml-auto text-xs text-gray-500">{stats.totalImages}</span>
                    </div>

                    {/* Duplicates */}
                    {stats.duplicateGroups > 0 && (
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-300 hover:bg-[#333333] rounded cursor-pointer">
                            <Copy size={14} className="text-orange-500" />
                            <span>Duplicates</span>
                            <span className="ml-auto text-xs text-orange-500">{stats.duplicateGroups}</span>
                        </div>
                    )}
                </div>

                {/* Current Folder Stats */}
                <div className="mt-4 px-2">
                    <div className="flex items-center px-2 py-1 text-xs font-semibold text-gray-400 uppercase mb-2">
                        <span>Current Folder</span>
                    </div>
                    <div className="text-xs px-2 text-gray-500">
                        {files.length} images in view
                    </div>
                </div>
            </div>
        </div>
    )
}
