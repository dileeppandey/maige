import React, { useEffect, useMemo } from 'react'
import type { FileInfo, LightAdjustments, ColorAdjustments } from '../shared/types'
import { LibraryPanel } from './components/panels/LibraryPanel'
import { RightPanel } from './components/panels/RightPanel'
import { PeoplePanel } from './components/panels/PeoplePanel'
import { DuplicatesPanel } from './components/panels/DuplicatesPanel'
import { Filmstrip } from './components/panels/Filmstrip'
import { ImagePreview } from './components/layout/ImagePreview'
import { ResizableLayout } from './components/layout/ResizableLayout'
import { FloatingActionBar } from './components/FloatingActionBar'
import { PickModeHeader } from './components/PickModeHeader'
import { useEditStore } from './store/useEditStore'
import { useLibraryStore } from './store/useLibraryStore'
import { useUIStore } from './store/useUIStore'
import { useFaceDetection } from './hooks/useFaceDetection'
import { useCallback } from 'react'

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
    updateColorAdjustment,
    copySettings,
    pasteSettings,
    resetAdjustments,
    hasClipboard,
    presets,
    savePreset,
    applyPreset,
    loadPresetsFromDisk
  } = useEditStore()

  // Load presets from disk at startup
  useEffect(() => {
    loadPresetsFromDisk()
  }, [loadPresetsFromDisk])

  // Get search state from library store
  const { searchResults, viewMode, showAllPhotos, selectedAlbumId, stats } = useLibraryStore()

  // Local state for file management
  const [currentPath, setCurrentPath] = React.useState<string | null>(null)
  const [files, setFiles] = React.useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = React.useState<FileInfo | null>(null)
  const [selectedPersonId, setSelectedPersonId] = React.useState<number | null>(null)
  const [personFiles, setPersonFiles] = React.useState<FileInfo[]>([])
  const [albumFiles, setAlbumFiles] = React.useState<FileInfo[]>([])
  const [histogramData, setHistogramData] = React.useState<{ r: number[]; g: number[]; b: number[]; lum: number[] } | null>(null)

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

  // Load album files when selectedAlbumId changes
  useEffect(() => {
    const loadAlbumFiles = async () => {
      if (viewMode === 'album' && selectedAlbumId) {
        try {
          const images = await window.electronAPI.getAlbumImages(selectedAlbumId)
          const fileInfos: FileInfo[] = images.map(img => ({
            name: img.file_path.split('/').pop() || '',
            path: img.file_path,
            isDirectory: false,
            type: 'image' as const,
          }))
          setAlbumFiles(fileInfos)
          // Select first photo if available
          if (fileInfos.length > 0) {
            setSelectedFile(fileInfos[0])
          }
        } catch (error) {
          console.error('Failed to load album images:', error)
        }
      }
    }
    loadAlbumFiles()
  }, [viewMode, selectedAlbumId])

  // Compute display files: person files, album files, search/library results, or folder files
  const displayFiles = useMemo<FileInfo[]>(() => {
    // If person is selected, show their photos
    if (viewMode === 'people' && selectedPersonId && personFiles.length > 0) {
      return personFiles
    }
    // If album is selected, show album photos
    if (viewMode === 'album' && selectedAlbumId && albumFiles.length > 0) {
      return albumFiles
    }
    // Show search results for search, tag filter, or library view modes
    if ((viewMode === 'library' || viewMode === 'search' || viewMode === 'tag') && searchResults.length > 0) {
      // Convert search results to FileInfo format
      return searchResults.map(result => ({
        name: result.file_path.split('/').pop() || '',
        path: result.file_path,
        isDirectory: false,
        type: 'image' as const,
        similarity: viewMode === 'search' ? result.similarity : undefined,
      }))
    }
    return files
  }, [viewMode, searchResults, files, selectedPersonId, personFiles, selectedAlbumId, albumFiles])

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
  const handleLightChange = useCallback((key: keyof LightAdjustments, value: number) => {
    if (selectedPath) {
      updateLightAdjustment(selectedPath, key, value)
    }
  }, [selectedPath, updateLightAdjustment])

  const handleColorChange = useCallback((key: keyof ColorAdjustments, value: number) => {
    if (selectedPath) {
      updateColorAdjustment(selectedPath, key, value)
    }
  }, [selectedPath, updateColorAdjustment])

  const handleCopySettings = useCallback(() => {
    if (selectedPath) {
      copySettings(selectedPath)
    }
  }, [selectedPath, copySettings])

  const handlePasteSettings = useCallback(() => {
    if (selectedPath) {
      pasteSettings(selectedPath)
    }
  }, [selectedPath, pasteSettings])

  const handleResetSettings = useCallback(() => {
    if (selectedPath) {
      resetAdjustments(selectedPath)
    }
  }, [selectedPath, resetAdjustments])

  const handleSavePreset = (name: string) => {
    savePreset(name, currentAdjustments)
  }

  const handleApplyPreset = (presetId: string) => {
    if (selectedPath) {
      applyPreset(selectedPath, presetId)
    }
  }

  // Get UI state
  const {
    showLibraryPanel,
    showDevelopPanel,
    showFilmstrip,
    togglePanel,
    zoomIn,
    zoomOut,
    zoomFit,
    toggleCompareMode,
    toggleBeforeAfter
  } = useUIStore()

  // Connect Menu Actions
  useEffect(() => {
    const cleanup = window.electronAPI.onMenuAction((action, data) => {
      console.log('Menu action:', action, data)

      switch (action) {
        // File
        case 'openFolder':
          if (typeof data === 'string') {
            setCurrentPath(data)
            window.electronAPI.readFolder(data).then(setFiles)
          }
          break
        case 'importImages':
          if (Array.isArray(data)) {
            // Logic to handle multiple images import could go here
            console.log('Importing multiple images:', data)
          }
          break
        case 'closeFolder':
          setCurrentPath(null)
          setFiles([])
          setSelectedFile(null)
          break

        // Edit & Library
        case 'undo':
          console.log('Undo requested')
          break
        case 'redo':
          console.log('Redo requested')
          break
        case 'selectAll':
          useLibraryStore.getState().selectAll()
          break
        case 'deselectAll':
          useLibraryStore.getState().clearSelection()
          break
        case 'invertSelection':
          useLibraryStore.getState().invertSelection()
          break

        // Metadata
        case 'setRating':
          if (typeof data === 'number') {
            useLibraryStore.getState().setRating(data)
          }
          break
        case 'setFlag':
          if (data === 'pick' || data === 'reject' || data === 'none') {
            useLibraryStore.getState().setFlag(data)
          }
          break

        // Library Features
        case 'newAlbum':
          console.log('New Album requested')
          break
        case 'semanticSearch':
          // Focus search bar or trigger search logic
          break

        // Develop
        case 'copyAdjustments':
          handleCopySettings()
          break
        case 'pasteAdjustments':
          handlePasteSettings()
          break
        case 'resetAdjustments':
          handleResetSettings()
          break

        // View / UI
        case 'togglePanel':
          if (data === 'library' || data === 'develop' || data === 'filmstrip') {
            togglePanel(data)
          }
          break
        case 'zoomIn': zoomIn(); break
        case 'zoomOut': zoomOut(); break
        case 'zoomFit': zoomFit(); break
        case 'compareMode': toggleCompareMode(); break
        case 'beforeAfter': toggleBeforeAfter(); break

        default:
          console.warn('Unhandled menu action:', action)
      }
    })

    return cleanup
  }, [handleCopySettings, handlePasteSettings, handleResetSettings, togglePanel, zoomIn, zoomOut, zoomFit, toggleCompareMode, toggleBeforeAfter])

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-gray-300 font-sans overflow-hidden">

      {/* Pick Mode Header (shown when adding photos to album) */}
      <PickModeHeader />

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
          ) : showLibraryPanel ? (
            <LibraryPanel
              currentPath={currentPath}
              files={files}
              onOpenFolder={handleOpenFolder}
            />
          ) : null
        }
        centerPanel={
          <ImagePreview
            selectedFile={selectedFile}
            adjustments={currentAdjustments}
            onHistogramChange={setHistogramData}
            files={displayFiles}
            onSelectFile={setSelectedFile}
            totalPhotos={stats.totalImages}
          />
        }
        rightPanel={
          showDevelopPanel ? (
            <RightPanel
              adjustments={currentAdjustments}
              onLightChange={handleLightChange}
              onColorChange={handleColorChange}
              onCopySettings={handleCopySettings}
              onPasteSettings={handlePasteSettings}
              onResetSettings={handleResetSettings}
              hasClipboard={hasClipboard()}
              presets={presets}
              onApplyPreset={handleApplyPreset}
              onSavePreset={handleSavePreset}
              selectedImagePath={selectedFile?.path}
              histogramData={histogramData}
            />
          ) : null
        }
      />

      {showFilmstrip && (
        <Filmstrip
          files={displayFiles}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
        />
      )}

      {/* Floating Action Bar for bulk operations */}
      <FloatingActionBar />

    </div>
  )
}

export default App

