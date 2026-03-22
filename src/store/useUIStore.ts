import { create } from 'zustand'

export type ToolId = 'select' | 'crop' | 'brush' | 'eraser' | 'pen' | 'ai' | 'text' | 'layers'

export interface CropRect {
    x: number
    y: number
    w: number
    h: number
}

export interface CropState {
    active: boolean
    rect: CropRect
    aspectRatio: string
}

const DEFAULT_CROP_STATE: CropState = {
    active: false,
    rect: { x: 0, y: 0, w: 1, h: 1 },
    aspectRatio: 'freeform',
}

interface UIState {
    showLibraryPanel: boolean
    showDevelopPanel: boolean
    showFilmstrip: boolean
    zoomLevel: number
    compareMode: boolean
    beforeAfter: boolean
    centerPanelMode: 'grid' | 'editor'
    showAIConfig: boolean
    activeTool: ToolId
    cropState: CropState

    // Actions
    setActiveTool: (tool: ToolId) => void
    setCropState: (update: Partial<CropState>) => void
    resetCropState: () => void
    togglePanel: (panel: 'library' | 'develop' | 'filmstrip') => void
    setZoom: (level: number) => void
    zoomIn: () => void
    zoomOut: () => void
    zoomFit: () => void
    zoomActual: () => void
    toggleCompareMode: () => void
    toggleBeforeAfter: () => void
    setCenterPanelMode: (mode: 'grid' | 'editor') => void
    toggleAIConfig: () => void
}

export const useUIStore = create<UIState>((set) => ({
    showLibraryPanel: true,
    showDevelopPanel: true,
    showFilmstrip: true,
    zoomLevel: 100,
    compareMode: false,
    beforeAfter: false,
    centerPanelMode: 'grid',
    showAIConfig: false,
    activeTool: 'select',
    cropState: { ...DEFAULT_CROP_STATE },

    setActiveTool: (tool) => set((state) => ({
        activeTool: tool,
        // Activate crop overlay when crop tool selected, deactivate when switching away
        cropState: tool === 'crop'
            ? { ...state.cropState, active: true }
            : state.cropState.active
                ? { ...DEFAULT_CROP_STATE }
                : state.cropState,
    })),

    setCropState: (update) => set((state) => ({
        cropState: { ...state.cropState, ...update },
    })),

    resetCropState: () => set({ cropState: { ...DEFAULT_CROP_STATE } }),

    togglePanel: (panel) => set((state) => {
        switch (panel) {
            case 'library': return { showLibraryPanel: !state.showLibraryPanel }
            case 'develop': return { showDevelopPanel: !state.showDevelopPanel }
            case 'filmstrip': return { showFilmstrip: !state.showFilmstrip }
            default: return state
        }
    }),

    setZoom: (level) => set({ zoomLevel: Math.max(10, Math.min(800, level)) }),

    zoomIn: () => set((state) => ({ zoomLevel: Math.min(800, state.zoomLevel + 10) })),

    zoomOut: () => set((state) => ({ zoomLevel: Math.max(10, state.zoomLevel - 10) })),

    zoomFit: () => set({ zoomLevel: 100 }), // Simplified, actual fit would depend on container

    zoomActual: () => set({ zoomLevel: 100 }),

    toggleCompareMode: () => set((state) => ({ compareMode: !state.compareMode })),

    toggleBeforeAfter: () => set((state) => ({ beforeAfter: !state.beforeAfter })),

    setCenterPanelMode: (mode) => set((state) => ({
        centerPanelMode: mode,
        // When switching to grid, activate select tool
        activeTool: mode === 'grid' ? 'select' : state.activeTool,
    })),

    toggleAIConfig: () => set((state) => ({ showAIConfig: !state.showAIConfig })),
}))

