import { create } from 'zustand'
import type { ImageAdjustments, StylePreset, LightAdjustments, ColorAdjustments } from '../../shared/types'
import { DEFAULT_IMAGE_ADJUSTMENTS, DEFAULT_LIGHT_ADJUSTMENTS, DEFAULT_COLOR_ADJUSTMENTS } from '../../shared/types'

interface EditRecord {
    adjustments: ImageAdjustments
    isDirty: boolean
    lastModified: string
}

interface EditState {
    // Per-image adjustments keyed by file path
    edits: Map<string, EditRecord>

    // Clipboard for copy/paste operations
    clipboard: ImageAdjustments | null

    // Saved style presets
    presets: StylePreset[]

    // Currently selected file path
    selectedPath: string | null

    // Actions
    setSelectedPath: (path: string | null) => void
    getAdjustments: (filePath: string | null) => ImageAdjustments
    updateLightAdjustment: (filePath: string, key: keyof LightAdjustments, value: number) => void
    updateColorAdjustment: (filePath: string, key: keyof ColorAdjustments, value: number) => void
    setAdjustments: (filePath: string, adjustments: ImageAdjustments) => void
    resetAdjustments: (filePath: string) => void
    resetAllAdjustments: () => void
    isDirty: (filePath: string | null) => boolean

    // Copy/paste
    copySettings: (filePath: string) => void
    pasteSettings: (filePath: string) => void
    hasClipboard: () => boolean

    // Presets
    savePreset: (name: string, adjustments: ImageAdjustments) => void
    applyPreset: (filePath: string, presetId: string) => void
    deletePreset: (presetId: string) => void
}

function checkIsDirty(adjustments: ImageAdjustments): boolean {
    const { light, color } = adjustments
    const defaultLight = DEFAULT_LIGHT_ADJUSTMENTS
    const defaultColor = DEFAULT_COLOR_ADJUSTMENTS

    const isLightDirty =
        light.exposure !== defaultLight.exposure ||
        light.contrast !== defaultLight.contrast ||
        light.highlights !== defaultLight.highlights ||
        light.shadows !== defaultLight.shadows ||
        light.whites !== defaultLight.whites ||
        light.blacks !== defaultLight.blacks

    const isColorDirty =
        (color?.temperature ?? 0) !== defaultColor.temperature ||
        (color?.tint ?? 0) !== defaultColor.tint ||
        (color?.saturation ?? 0) !== defaultColor.saturation ||
        (color?.vibrance ?? 0) !== defaultColor.vibrance

    return isLightDirty || isColorDirty
}

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const useEditStore = create<EditState>((set, get) => ({
    edits: new Map(),
    clipboard: null,
    presets: [],
    selectedPath: null,

    setSelectedPath: (path) => set({ selectedPath: path }),

    getAdjustments: (filePath) => {
        if (!filePath) return DEFAULT_IMAGE_ADJUSTMENTS
        const edit = get().edits.get(filePath)
        return edit?.adjustments ?? DEFAULT_IMAGE_ADJUSTMENTS
    },

    updateLightAdjustment: (filePath, key, value) => {
        set((state) => {
            const current = state.edits.get(filePath)?.adjustments ?? DEFAULT_IMAGE_ADJUSTMENTS
            const newAdjustments: ImageAdjustments = {
                ...current,
                light: {
                    ...current.light,
                    [key]: value
                }
            }
            const newEdits = new Map(state.edits)
            newEdits.set(filePath, {
                adjustments: newAdjustments,
                isDirty: checkIsDirty(newAdjustments),
                lastModified: new Date().toISOString()
            })
            return { edits: newEdits }
        })
    },

    updateColorAdjustment: (filePath, key, value) => {
        set((state) => {
            const current = state.edits.get(filePath)?.adjustments ?? DEFAULT_IMAGE_ADJUSTMENTS
            const currentColor = current.color ?? DEFAULT_COLOR_ADJUSTMENTS
            const newAdjustments: ImageAdjustments = {
                ...current,
                color: {
                    ...currentColor,
                    [key]: value
                }
            }
            const newEdits = new Map(state.edits)
            newEdits.set(filePath, {
                adjustments: newAdjustments,
                isDirty: checkIsDirty(newAdjustments),
                lastModified: new Date().toISOString()
            })
            return { edits: newEdits }
        })
    },

    setAdjustments: (filePath, adjustments) => {
        set((state) => {
            const newEdits = new Map(state.edits)
            newEdits.set(filePath, {
                adjustments,
                isDirty: checkIsDirty(adjustments),
                lastModified: new Date().toISOString()
            })
            return { edits: newEdits }
        })
    },

    resetAdjustments: (filePath) => {
        set((state) => {
            const newEdits = new Map(state.edits)
            newEdits.delete(filePath)
            return { edits: newEdits }
        })
    },

    resetAllAdjustments: () => {
        set({ edits: new Map() })
    },

    isDirty: (filePath) => {
        if (!filePath) return false
        return get().edits.get(filePath)?.isDirty ?? false
    },

    // Copy current image settings to clipboard
    copySettings: (filePath) => {
        const adjustments = get().getAdjustments(filePath)
        set({ clipboard: { ...adjustments } })
    },

    // Paste clipboard settings to target image
    pasteSettings: (filePath) => {
        const clipboard = get().clipboard
        if (!clipboard) return
        get().setAdjustments(filePath, { ...clipboard })
    },

    hasClipboard: () => get().clipboard !== null,

    // Save current adjustments as a named preset
    savePreset: (name, adjustments) => {
        const preset: StylePreset = {
            id: generateId(),
            name,
            adjustments: { ...adjustments },
            createdAt: new Date().toISOString()
        }
        set((state) => ({
            presets: [...state.presets, preset]
        }))
    },

    // Apply a preset to an image
    applyPreset: (filePath, presetId) => {
        const preset = get().presets.find(p => p.id === presetId)
        if (!preset) return
        get().setAdjustments(filePath, { ...preset.adjustments })
    },

    // Delete a preset
    deletePreset: (presetId) => {
        set((state) => ({
            presets: state.presets.filter(p => p.id !== presetId)
        }))
    }
}))
