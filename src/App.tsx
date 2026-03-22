import React, { useEffect, useMemo, useRef } from 'react'
import type { FileInfo, ImageAdjustments, LightAdjustments, ColorAdjustments } from '../shared/types'
import { LibraryPanel } from './components/panels/LibraryPanel'
import { RightPanel } from './components/panels/RightPanel'
import { AIEditorPanel } from './components/panels/AIEditorPanel'
import { PeoplePanel } from './components/panels/PeoplePanel'
import { DuplicatesPanel } from './components/panels/DuplicatesPanel'
import { Filmstrip } from './components/panels/Filmstrip'
import { ImagePreview } from './components/layout/ImagePreview'
import type { ImageViewerHandle } from './components/viewer/ImageViewer'
import { ResizableLayout } from './components/layout/ResizableLayout'
import ToolSidebar from './components/layout/ToolSidebar'
import CropToolbar from './components/tools/CropToolbar'
import { BrushSettingsPanel } from './components/tools/BrushSettingsPanel'
import { MaskSelectionPanel } from './components/tools/MaskSelectionPanel'
import { TextOverlayPanel } from './components/tools/TextOverlayPanel'
import { LayersPanel } from './components/tools/LayersPanel'
import { ImageInfoPanel } from './components/panels/ImageInfoPanel'
import { FloatingActionBar } from './components/FloatingActionBar'
import { PickModeHeader } from './components/PickModeHeader'
import { CreateAlbumModal } from './components/CreateAlbumModal'
import { AIConfigModal } from './components/modals/AIConfigModal'
import { useEditStore } from './store/useEditStore'
import { useLibraryStore } from './store/useLibraryStore'
import { useUIStore } from './store/useUIStore'
import { useAIStore } from './store/useAIStore'
import { useThemeStore } from './store/useThemeStore'
import { useFaceDetection } from './hooks/useFaceDetection'
import { useCallback } from 'react'

function App() {
  // Initialize theme management
  const { theme } = useThemeStore()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])
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

  // Load AI config on startup
  const { loadConfig: loadAIConfig } = useAIStore()
  useEffect(() => {
    loadAIConfig()
  }, [loadAIConfig])

  // Get search state from library store
  const { searchResults, viewMode, showAllPhotos, selectedAlbumId, stats, selectedCluster } = useLibraryStore()

  // Local state for file management
  const [selectedFile, setSelectedFile] = React.useState<FileInfo | null>(null)
  const [selectedPersonId, setSelectedPersonId] = React.useState<number | null>(null)
  const [personFiles, setPersonFiles] = React.useState<FileInfo[]>([])
  const [albumFiles, setAlbumFiles] = React.useState<FileInfo[]>([])
  const [clusterFiles, setClusterFiles] = React.useState<FileInfo[]>([])
  const [histogramData, setHistogramData] = React.useState<{ r: number[]; g: number[]; b: number[]; lum: number[] } | null>(null)
  const [showCreateAlbumModal, setShowCreateAlbumModal] = React.useState(false)
  const [imageDimensions, setImageDimensions] = React.useState({ width: 0, height: 0 })
  const imageViewerRef = useRef<ImageViewerHandle>(null)

  // Handle person selection - load their photos
  const handleSelectPerson = async (personId: number) => {
    setSelectedPersonId(personId)
    try {
      const images = await window.api.getImagesByPerson(personId)
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
          const images = await window.api.getAlbumImages(selectedAlbumId)
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

  // Load cluster face images when a cluster is selected
  useEffect(() => {
    const loadClusterFaces = async () => {
      if (viewMode === 'cluster' && selectedCluster) {
        try {
          // Get image paths for each face in the cluster
          const faceImages = await Promise.all(
            selectedCluster.faceIds.map(async (faceId) => {
              const faceInfo = await window.api.getFaceInfo(faceId)
              return faceInfo
            })
          )

          // Define the face info type
          type FaceInfo = NonNullable<Awaited<ReturnType<typeof window.api.getFaceInfo>>>

          // Convert to FileInfo, filtering out nulls and deduping by path
          const seenPaths = new Set<string>()
          const fileInfos: FileInfo[] = (faceImages.filter((info): info is FaceInfo => info !== null) as FaceInfo[])
            .filter(info => {
              if (seenPaths.has(info.image_path)) return false
              seenPaths.add(info.image_path)
              return true
            })
            .map(info => ({
              name: info.image_path.split('/').pop() || '',
              path: info.image_path,
              isDirectory: false,
              type: 'image' as const,
            }))

          setClusterFiles(fileInfos)
          if (fileInfos.length > 0) {
            setSelectedFile(fileInfos[0])
          }
        } catch (error) {
          console.error('Failed to load cluster images:', error)
          setClusterFiles([])
        }
      }
    }
    loadClusterFaces()
  }, [viewMode, selectedCluster])

  // Compute display files: cluster, person files, album files, search/library results, or folder files
  const displayFiles = useMemo<FileInfo[]>(() => {
    // If person is selected (named person), show their photos
    // This works from People Albums (library mode) or People panel (people/cluster modes)
    if (selectedPersonId && personFiles.length > 0) {
      return personFiles
    }
    // If cluster is selected (not a named person), show cluster face images
    if (viewMode === 'cluster' && selectedCluster && clusterFiles.length > 0) {
      return clusterFiles
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
    return []
  }, [viewMode, searchResults, selectedPersonId, personFiles, selectedAlbumId, albumFiles, selectedCluster, clusterFiles])

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

  const handleApplyBuiltIn = useCallback((adj: Partial<ImageAdjustments>) => {
    if (!selectedPath) return
    if (adj.light) {
      Object.entries(adj.light).forEach(([k, v]) =>
        updateLightAdjustment(selectedPath, k as keyof LightAdjustments, v)
      )
    }
    if (adj.color) {
      Object.entries(adj.color).forEach(([k, v]) =>
        updateColorAdjustment(selectedPath, k as keyof ColorAdjustments, v)
      )
    }
  }, [selectedPath, updateLightAdjustment, updateColorAdjustment])

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
    centerPanelMode,
    setCenterPanelMode,
    activeTool,
    setActiveTool,
    cropState,
    setCropState,
    togglePanel,
    zoomIn,
    zoomOut,
    zoomFit,
    toggleCompareMode,
    toggleBeforeAfter
  } = useUIStore()

  // Connect Menu Actions
  useEffect(() => {
    const cleanup = window.api.onMenuAction((action, data) => {
      console.log('Menu action:', action, data)

      switch (action) {
        // File
        case 'openFolder':
          window.api.selectFolder().then(path => {
            if (path) useLibraryStore.getState().importFolder(path)
          })
          break
        case 'importImages':
          if (Array.isArray(data)) {
            // Logic to handle multiple images import could go here
            console.log('Importing multiple images:', data)
          }
          break
        case 'closeFolder':
          setSelectedFile(null)
          useLibraryStore.getState().showAllPhotos()
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
          setShowCreateAlbumModal(true)
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
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-[#1e1e1e] text-gray-700 dark:text-gray-300 font-sans overflow-hidden">

      {/* Pick Mode Header (shown when adding photos to album) */}
      <PickModeHeader />

      {/* Main Area: ToolSidebar + ResizableLayout */}
      <div className="flex-1 flex min-h-0">
        {/* Vertical tool sidebar on far left */}
        <ToolSidebar
          activeTool={activeTool}
          onToolChange={(tool) => {
            setActiveTool(tool as any)
            // Only switch to grid when explicitly clicking select while already in grid,
            // or when no image is selected. Otherwise stay in editor mode.
            if (tool !== 'select') {
              setCenterPanelMode('editor')
            }
          }}
        />

        {/* Three-panel resizable layout */}
        <ResizableLayout
          leftPanel={
            centerPanelMode === 'editor' && showLibraryPanel ? (
              activeTool === 'select' ? (
                <ImageInfoPanel
                  fileName={selectedFile?.name}
                  filePath={selectedFile?.path}
                  dimensions={imageDimensions}
                />
              ) : activeTool === 'ai' ? (
                <AIEditorPanel
                  selectedImagePath={selectedFile?.path ?? null}
                  onApplyAdjustments={(adj) => {
                    if (adj.light) {
                      Object.entries(adj.light).forEach(([k, v]) =>
                        handleLightChange(k as keyof LightAdjustments, v)
                      )
                    }
                    if (adj.color) {
                      Object.entries(adj.color).forEach(([k, v]) =>
                        handleColorChange(k as keyof ColorAdjustments, v)
                      )
                    }
                  }}
                />
              ) : activeTool === 'crop' ? (
                <CropToolbar
                  imageDimensions={imageDimensions}
                  onRotate={() => {
                    imageViewerRef.current?.applyRotate90()
                  }}
                  onFlip={() => {
                    imageViewerRef.current?.applyFlipH()
                  }}
                  onApply={() => {
                    const viewer = imageViewerRef.current
                    if (viewer) {
                      const { rect } = cropState
                      if (rect.x !== 0 || rect.y !== 0 || rect.w < 0.99 || rect.h < 0.99) {
                        viewer.applyCrop(rect)
                      }
                    }
                    setCropState({ rect: { x: 0, y: 0, w: 1, h: 1 }, aspectRatio: 'freeform' })
                  }}
                  onCancel={() => {
                    setCropState({ rect: { x: 0, y: 0, w: 1, h: 1 }, aspectRatio: 'freeform' })
                  }}
                />
              ) : activeTool === 'brush' || activeTool === 'eraser' ? (
                <BrushSettingsPanel />
              ) : activeTool === 'pen' ? (
                <MaskSelectionPanel />
              ) : activeTool === 'text' ? (
                <TextOverlayPanel />
              ) : activeTool === 'layers' ? (
                <LayersPanel onClose={() => {}} />
              ) : null
            ) : viewMode === 'people' || viewMode === 'cluster' ? (
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
                onSelectPerson={handleSelectPerson}
                onClearPerson={() => {
                  setSelectedPersonId(null)
                  setPersonFiles([])
                }}
              />
            ) : null
          }
          centerPanel={
            <ImagePreview
              ref={imageViewerRef}
              selectedFile={selectedFile}
              adjustments={currentAdjustments}
              onHistogramChange={setHistogramData}
              onDimensionsChange={setImageDimensions}
              files={displayFiles}
              onSelectFile={setSelectedFile}
              totalPhotos={displayFiles.length > 0 ? displayFiles.length : stats.totalImages}
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
                onApplyBuiltIn={handleApplyBuiltIn}
                selectedImagePath={selectedFile?.path}
                histogramData={histogramData}
              />
            ) : null
          }
        />
      </div>

      {showFilmstrip && (
        <Filmstrip
          files={displayFiles}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
        />
      )}

      {/* Floating Action Bar for bulk operations */}
      <FloatingActionBar />

      {/* Create Album Modal */}
      <CreateAlbumModal
        isOpen={showCreateAlbumModal}
        onClose={() => setShowCreateAlbumModal(false)}
      />

      {/* AI Config Modal */}
      <AIConfigModal />

    </div>
  )
}

export default App

