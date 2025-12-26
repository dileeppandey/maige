import React, { useEffect, useMemo } from 'react'
import type { FileInfo, LightAdjustments } from '../shared/types'
import { LibraryPanel } from './components/panels/LibraryPanel'
import { DevelopPanel } from './components/panels/DevelopPanel'
import { PeoplePanel } from './components/panels/PeoplePanel'
import { DuplicatesPanel } from './components/panels/DuplicatesPanel'
import { Filmstrip } from './components/panels/Filmstrip'
import { ImagePreview } from './components/layout/ImagePreview'
import { ResizableLayout } from './components/layout/ResizableLayout'
import { useEditStore } from './store/useEditStore'
import { useLibraryStore } from './store/useLibraryStore'
import { useFaceDetection } from './hooks/useFaceDetection'

function App() {
  // Initialize face detection processing (runs in background after imports)
  const faceDetectionStatus = useFaceDetection()

  // Log face detection progress
  useEffect(() => {
    if (faceDetectionStatus.isProcessing) {
      console.log(`Face detection: ${faceDetectionStatus.current}/${faceDetectionStatus.total} - ${faceDetectionStatus.currentFile}`)
    }
  }, [faceDetectionStatus])

  // Get state and actions from the edit store
  const {
    selectedPath,
    setSelectedPath,
    getAdjustments,
    updateLightAdjustment,
    copySettings,
    pasteSettings,
    resetAdjustments,
    hasClipboard,
    presets,
    savePreset,
    applyPreset
  } = useEditStore()

  // Get search state from library store
  const { searchResults, viewMode, showAllPhotos } = useLibraryStore()

  // Local state for file management
  const [currentPath, setCurrentPath] = React.useState<string | null>(null)
  const [files, setFiles] = React.useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = React.useState<FileInfo | null>(null)
  const [selectedPersonId, setSelectedPersonId] = React.useState<number | null>(null)
  const [personFiles, setPersonFiles] = React.useState<FileInfo[]>([])

  // Handle person selection - load their photos
  const handleSelectPerson = async (personId: number) => {
    setSelectedPersonId(personId)
    try {
      const images = await window.electronAPI.getImagesByPerson(personId)
      const fileInfos: FileInfo[] = images.map(img => ({
        name: img.file_path.split('/').pop() || '',
        path: img.file_path,
        isDirectory: false,
        type: 'image' as const,
      }))
      setPersonFiles(fileInfos)
      // Select first photo if available
      if (fileInfos.length > 0) {
        setSelectedFile(fileInfos[0])
      }
    } catch (error) {
      console.error('Failed to load person images:', error)
    }
  }

  // Compute display files: person files, search/library results, or folder files
  const displayFiles = useMemo<FileInfo[]>(() => {
    // If person is selected, show their photos
    if (viewMode === 'people' && selectedPersonId && personFiles.length > 0) {
      return personFiles
    }
    // Show search results for search, tag filter, or library view modes
    if ((viewMode === 'library' || viewMode === 'search' || viewMode === 'tag') && searchResults.length > 0) {
      // Convert search results to FileInfo format
      return searchResults.map(result => ({
        name: result.file_path.split('/').pop() || '',
        path: result.file_path,
        isDirectory: false,
        type: 'image' as const,
      }))
    }
    return files
  }, [viewMode, searchResults, files, selectedPersonId, personFiles])

  // Sync selected file with edit store
  useEffect(() => {
    setSelectedPath(selectedFile?.path ?? null)
  }, [selectedFile, setSelectedPath])

  // Listen for showLibrary event from PeoplePanel back button
  useEffect(() => {
    const handleShowLibrary = () => showAllPhotos()
    window.addEventListener('showLibrary', handleShowLibrary)
    return () => window.removeEventListener('showLibrary', handleShowLibrary)
  }, [showAllPhotos])

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

  // Get current adjustments for selected file
  const currentAdjustments = getAdjustments(selectedPath)

  // Handlers for DevelopPanel
  const handleLightChange = (key: keyof LightAdjustments, value: number) => {
    if (selectedPath) {
      updateLightAdjustment(selectedPath, key, value)
    }
  }

  const handleCopySettings = () => {
    if (selectedPath) {
      copySettings(selectedPath)
    }
  }

  const handlePasteSettings = () => {
    if (selectedPath) {
      pasteSettings(selectedPath)
    }
  }

  const handleResetSettings = () => {
    if (selectedPath) {
      resetAdjustments(selectedPath)
    }
  }

  const handleSavePreset = (name: string) => {
    savePreset(name, currentAdjustments)
  }

  const handleApplyPreset = (presetId: string) => {
    if (selectedPath) {
      applyPreset(selectedPath, presetId)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-gray-300 font-sans overflow-hidden">

      {/* Top Main Area (Columns) */}
      <ResizableLayout
        leftPanel={
          viewMode === 'people' ? (
            <PeoplePanel
              onSelectPerson={handleSelectPerson}
              selectedPersonId={selectedPersonId}
            />
          ) : viewMode === 'duplicates' ? (
            <DuplicatesPanel
              onSelectImage={(path) => {
                setSelectedFile({
                  name: path.split('/').pop() || '',
                  path,
                  isDirectory: false,
                  type: 'image',
                })
              }}
            />
          ) : (
            <LibraryPanel
              currentPath={currentPath}
              files={files}
              onOpenFolder={handleOpenFolder}
            />
          )
        }
        centerPanel={
          <ImagePreview
            selectedFile={selectedFile}
            adjustments={currentAdjustments}
          />
        }
        rightPanel={
          <DevelopPanel
            adjustments={currentAdjustments}
            onLightChange={handleLightChange}
            onCopySettings={handleCopySettings}
            onPasteSettings={handlePasteSettings}
            onResetSettings={handleResetSettings}
            hasClipboard={hasClipboard()}
            presets={presets}
            onApplyPreset={handleApplyPreset}
            onSavePreset={handleSavePreset}
            selectedImagePath={selectedFile?.path}
          />
        }
      />

      <Filmstrip
        files={displayFiles}
        selectedFile={selectedFile}
        onSelectFile={setSelectedFile}
      />

    </div>
  )
}

export default App

