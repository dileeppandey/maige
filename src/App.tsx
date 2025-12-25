import { useState } from 'react'
import type { FileInfo } from '../shared/types'
import { LibraryPanel } from './components/panels/LibraryPanel'
import { DevelopPanel } from './components/panels/DevelopPanel'
import { Filmstrip } from './components/panels/Filmstrip'
import { ImagePreview } from './components/layout/ImagePreview'
import { ResizableLayout } from './components/layout/ResizableLayout'

function App() {
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)

  const handleOpenFolder = async () => {
    try {
      const path = await window.electronAPI.selectFolder()
      if (path) {
        setCurrentPath(path)
        const files = await window.electronAPI.readFolder(path)
        setFiles(files)
        if (files.length > 0) {
          setSelectedFile(files[0])
        }
      }
    } catch (error) {
      console.error("Error opening folder:", error)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-gray-300 font-sans overflow-hidden">

      {/* Top Main Area (Columns) */}
      <ResizableLayout
        leftPanel={
          <LibraryPanel
            currentPath={currentPath}
            files={files}
            onOpenFolder={handleOpenFolder}
          />
        }
        centerPanel={<ImagePreview selectedFile={selectedFile} />}
        rightPanel={<DevelopPanel />}
      />

      <Filmstrip
        files={files}
        selectedFile={selectedFile}
        onSelectFile={setSelectedFile}
      />

    </div>
  )
}

export default App
