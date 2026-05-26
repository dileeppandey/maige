import { create } from 'zustand';
import type { ChatMessage, RegionSelection } from '../../shared/types';

interface ChatState {
    messages: ChatMessage[];
    pendingRegion: RegionSelection | null;
    isAnalyzing: boolean;
    ollamaAvailable: boolean | null;

    addMessage: (msg: ChatMessage) => void;
    setPendingRegion: (region: RegionSelection | null) => void;
    setAnalyzing: (v: boolean) => void;
    setOllamaAvailable: (v: boolean) => void;
    clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    pendingRegion: null,
    isAnalyzing: false,
    ollamaAvailable: null,

    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    setPendingRegion: (region) => set({ pendingRegion: region }),
    setAnalyzing: (v) => set({ isAnalyzing: v }),
    setOllamaAvailable: (v) => set({ ollamaAvailable: v }),
    clearMessages: () => set({ messages: [] }),
}));
