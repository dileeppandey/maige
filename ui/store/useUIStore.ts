import { create } from 'zustand'

interface UIState {
    showLibraryPanel: boolean
    showDevelopPanel: boolean
    showFilmstrip: boolean
    zoomLevel: number
    compareMode: boolean
    beforeAfter: boolean
    centerPanelMode: 'grid' | 'editor'

    // Actions
    togglePanel: (panel: 'library' | 'develop' | 'filmstrip') => void
    setZoom: (level: number) => void
    zoomIn: () => void
    zoomOut: () => void
    zoomFit: () => void
    zoomActual: () => void
    toggleCompareMode: () => void
    toggleBeforeAfter: () => void
    setCenterPanelMode: (mode: 'grid' | 'editor') => void
}

export const useUIStore = create<UIState>((set) => ({
    showLibraryPanel: true,
    showDevelopPanel: true,
    showFilmstrip: true,
    zoomLevel: 100,
    compareMode: false,
    beforeAfter: false,
    centerPanelMode: 'grid',

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

    setCenterPanelMode: (mode) => set({ centerPanelMode: mode }),
}))

