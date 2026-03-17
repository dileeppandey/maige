import { create } from 'zustand'
import type { AIMessage, AIConfig, BatchOperation, ImageAdjustments, ColorAdjustments } from '../../shared/types'
import { DEFAULT_IMAGE_ADJUSTMENTS } from '../../shared/types'
import { getEditSuggestions } from '../services/aiService'
import { useEditStore } from './useEditStore'

interface AIState {
    messages: AIMessage[]
    isThinking: boolean
    isBatchProcessing: boolean
    batchProgress: { current: number; total: number }
    batchInstruction: string
    batchOperations: Record<BatchOperation, boolean>
    config: AIConfig

    // Actions
    sendMessage: (filePath: string, instruction: string) => Promise<void>
    applyProposal: (messageId: string) => void
    clearMessages: () => void
    setBatchInstruction: (text: string) => void
    toggleBatchOperation: (op: BatchOperation) => void
    runBatch: (filePaths: string[]) => Promise<void>
    setConfig: (config: Partial<AIConfig>) => void
    loadConfig: () => Promise<void>
    saveConfig: () => Promise<void>
}

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

const DEFAULT_CONFIG: AIConfig = {
    provider: 'claude',
    inputChannels: {
        textPrompts: true,
        imageReference: true,
        voiceInput: true,
    },
}

const DEFAULT_BATCH_OPERATIONS: Record<BatchOperation, boolean> = {
    colorGrading: false,
    autoEnhance: false,
    noiseReduction: false,
    smartCrop: false,
}

export const useAIStore = create<AIState>((set, get) => ({
    messages: [],
    isThinking: false,
    isBatchProcessing: false,
    batchProgress: { current: 0, total: 0 },
    batchInstruction: '',
    batchOperations: { ...DEFAULT_BATCH_OPERATIONS },
    config: { ...DEFAULT_CONFIG },

    sendMessage: async (filePath: string, instruction: string) => {
        set({ isThinking: true })

        const userMessage: AIMessage = {
            id: generateId(),
            role: 'user',
            content: instruction,
            applied: false,
            timestamp: new Date().toISOString(),
        }

        set((state) => ({ messages: [...state.messages, userMessage] }))

        try {
            const proposedAdjustments = await getEditSuggestions(
                filePath,
                instruction,
                get().config.provider
            )

            const assistantMessage: AIMessage = {
                id: generateId(),
                role: 'assistant',
                content: 'Here are the suggested adjustments based on your instruction.',
                proposedAdjustments,
                applied: false,
                timestamp: new Date().toISOString(),
            }

            set((state) => ({
                messages: [...state.messages, assistantMessage],
                isThinking: false,
            }))
        } catch (e) {
            console.error('sendMessage error:', e)

            const errorMessage: AIMessage = {
                id: generateId(),
                role: 'assistant',
                content: 'Sorry, I encountered an error processing your request.',
                applied: false,
                timestamp: new Date().toISOString(),
            }

            set((state) => ({
                messages: [...state.messages, errorMessage],
                isThinking: false,
            }))
        }
    },

    applyProposal: (messageId: string) => {
        const state = get()
        const message = state.messages.find((m) => m.id === messageId)
        if (!message || !message.proposedAdjustments) return

        const editStore = useEditStore.getState()
        const selectedPath = editStore.selectedPath
        if (!selectedPath) return

        const currentAdjustments = editStore.getAdjustments(selectedPath)

        // Merge proposed adjustments into current adjustments
        const merged: ImageAdjustments = {
            light: {
                ...currentAdjustments.light,
                ...(message.proposedAdjustments.light ?? {}),
            },
            color: {
                ...(currentAdjustments.color ?? DEFAULT_IMAGE_ADJUSTMENTS.color),
                ...Object.fromEntries(
                    Object.entries(message.proposedAdjustments.color ?? {}).filter(([, v]) => v !== undefined)
                ),
            } as ColorAdjustments,
        }

        editStore.setAdjustments(selectedPath, merged)

        // Mark the message as applied
        set((s) => ({
            messages: s.messages.map((m) =>
                m.id === messageId ? { ...m, applied: true } : m
            ),
        }))
    },

    clearMessages: () => set({ messages: [] }),

    setBatchInstruction: (text: string) => set({ batchInstruction: text }),

    toggleBatchOperation: (op: BatchOperation) => {
        set((state) => ({
            batchOperations: {
                ...state.batchOperations,
                [op]: !state.batchOperations[op],
            },
        }))
    },

    runBatch: async (filePaths: string[]) => {
        const state = get()
        set({
            isBatchProcessing: true,
            batchProgress: { current: 0, total: filePaths.length },
        })

        const editStore = useEditStore.getState()

        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i]
            try {
                const proposedAdjustments = await getEditSuggestions(
                    filePath,
                    state.batchInstruction,
                    get().config.provider
                )

                const currentAdjustments = editStore.getAdjustments(filePath)
                const merged: ImageAdjustments = {
                    light: {
                        ...currentAdjustments.light,
                        ...(proposedAdjustments.light ?? {}),
                    },
                    color: {
                        ...(currentAdjustments.color ?? DEFAULT_IMAGE_ADJUSTMENTS.color),
                        ...Object.fromEntries(
                            Object.entries(proposedAdjustments.color ?? {}).filter(([, v]) => v !== undefined)
                        ),
                    } as ColorAdjustments,
                }
                editStore.setAdjustments(filePath, merged)
            } catch (e) {
                console.error(`runBatch error for ${filePath}:`, e)
            }

            set({ batchProgress: { current: i + 1, total: filePaths.length } })
        }

        set({ isBatchProcessing: false })
    },

    setConfig: (config: Partial<AIConfig>) => {
        set((state) => ({
            config: {
                ...state.config,
                ...config,
                inputChannels: {
                    ...state.config.inputChannels,
                    ...(config.inputChannels ?? {}),
                },
            },
        }))
    },

    loadConfig: async () => {
        try {
            const loaded = await window.api.loadAIConfig()
            if (loaded) {
                set({ config: loaded as AIConfig })
            }
        } catch (e) {
            console.error('loadConfig error:', e)
        }
    },

    saveConfig: async () => {
        try {
            await window.api.saveAIConfig(get().config)
        } catch (e) {
            console.error('saveConfig error:', e)
        }
    },
}))
