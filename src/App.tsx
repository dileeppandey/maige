import { useState } from 'react'
import type { FileInfo } from '../shared/types'
import { FolderOpen, Image as ImageIcon } from 'lucide-react'

function App() {
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)

  const handleOpenFolder = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      setCurrentPath(path)
      const files = await window.electronAPI.readFolder(path)
      setFiles(files)
    }
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-100">Explorer</span>
            <button
              onClick={handleOpenFolder}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Open Folder"
            >
              <FolderOpen size={18} />
            </button>
          </div>
          {currentPath && (
            <div className="text-xs text-gray-400 break-all">
              {currentPath}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {files.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No folder opened or empty
            </div>
          ) : (
            <div className="py-2">
              {files.map((file) => (
                <div
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`
                    flex items-center gap-2 px-4 py-2 cursor-pointer text-sm
                    ${selectedFile?.path === file.path ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}
                  `}
                >
                  <ImageIcon size={14} className="opacity-70" />
                  <span className="truncate">{file.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gray-950">
        {selectedFile ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-gray-400 mb-4">Selected: {selectedFile.name}</p>
              {/* Image preview will go here */}
              <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-hidden">
                <img
                  src={`media://${selectedFile.path}`}
                  alt={selectedFile.name}
                  className="max-w-full max-h-[80vh] object-contain shadow-lg"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select an image to view
          </div>
        )}
      </div>
    </div>
  )
}

export default App
