import { create } from 'zustand'

export type AiProvider = 'none' | 'ollama'
export type ExportFormat = 'jpeg' | 'png'

export interface AppSettings {
    // General
    export_format: ExportFormat
    export_quality: string  // stored as string in DB
    import_skip_duplicates: string  // 'true' | 'false'

    // AI Assistant
    ai_provider: AiProvider
    ollama_endpoint: string
    ollama_model: string
    ai_auto_scene_analysis: string  // 'true' | 'false'

    // Interface
    default_center_mode: 'grid' | 'editor'
}

export const DEFAULT_SETTINGS: AppSettings = {
    export_format: 'jpeg',
    export_quality: '90',
    import_skip_duplicates: 'true',
    ai_provider: 'none',
    ollama_endpoint: 'http://localhost:11434',
    ollama_model: 'gemma4:e4b',
    ai_auto_scene_analysis: 'true',
    default_center_mode: 'grid',
}

interface SettingsState {
    settings: AppSettings
    loaded: boolean

    loadSettings: () => Promise<void>
    updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    settings: { ...DEFAULT_SETTINGS },
    loaded: false,

    loadSettings: async () => {
        const raw = await window.api.getSettings()
        const merged: AppSettings = { ...DEFAULT_SETTINGS }

        for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
            if (raw[key] !== undefined) {
                (merged as Record<string, string>)[key] = raw[key]
            }
        }

        set({ settings: merged, loaded: true })
    },

    updateSetting: async (key, value) => {
        set((state) => ({
            settings: { ...state.settings, [key]: value },
        }))
        await window.api.saveSetting(key, value as string)
    },
}))
