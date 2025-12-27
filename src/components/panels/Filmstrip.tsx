import type { FileInfo } from '../../../shared/types'

interface FilmstripProps {
    files: FileInfo[]
    selectedFile: FileInfo | null
    onSelectFile: (file: FileInfo) => void
}

export function Filmstrip({ files, selectedFile, onSelectFile }: FilmstripProps) {
    return (
        <div className="h-[120px] bg-[#252525] border-t border-[#333333] flex flex-col">
            <div className="h-6 flex items-center px-2 bg-[#1f1f1f] border-b border-[#333333] text-[10px] text-gray-500">
                <span>Filmstrip</span>
            </div>
            <div className="flex-1 overflow-x-auto p-2 flex items-center gap-2">
                {files.map((file) => (
                    <div
                        key={file.path}
                        onClick={() => onSelectFile(file)}
                        className={`
                h-full aspect-[4/3] flex-shrink-0 border-2 rounded overflow-hidden cursor-pointer relative group
                ${selectedFile?.path === file.path ? 'border-blue-500' : 'border-transparent hover:border-gray-600'}
              `}
                    >
                        <img
                            src={`media://${file.path}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        {file.similarity !== undefined && (
                            <div className="absolute top-1 left-1 bg-blue-600/80 text-white text-[8px] px-1 rounded font-bold">
                                {Math.round(file.similarity * 100)}%
                            </div>
                        )}
                        <div className="absolute inset-0 bg-transparent group-hover:bg-white/5 transition-colors"></div>
                    </div>
                ))}
            </div>
        </div>
    )
}
