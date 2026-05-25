import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import type { ChatMessage } from '../../shared/types';

function newId() {
    return Math.random().toString(36).slice(2);
}

export function useSceneAnalysis(selectedPath: string | null) {
    const analyzedPaths = useRef<Set<string>>(new Set());
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const addMessage = useChatStore((s) => s.addMessage);
    const clearMessages = useChatStore((s) => s.clearMessages);
    const setAnalyzing = useChatStore((s) => s.setAnalyzing);
    const setOllamaAvailable = useChatStore((s) => s.setOllamaAvailable);

    // Check Ollama on mount
    useEffect(() => {
        window.api.checkOllamaStatus().then((ok: boolean) => {
            setOllamaAvailable(ok);
        });
    }, [setOllamaAvailable]);

    useEffect(() => {
        if (!selectedPath) return;

        // Clear previous timer
        if (timerRef.current) clearTimeout(timerRef.current);

        // Fresh chat for each image
        clearMessages();

        if (analyzedPaths.current.has(selectedPath)) return;

        timerRef.current = setTimeout(async () => {
            const available = await window.api.checkOllamaStatus() as boolean;
            setOllamaAvailable(available);
            if (!available) return;

            analyzedPaths.current.add(selectedPath);
            setAnalyzing(true);

            try {
                const result = await window.api.analyzeImageScene(selectedPath) as {
                    message: string;
                    adjustments: null;
                    suggestions: Array<{ label: string; adjustments: Record<string, number> }>;
                };

                const msg: ChatMessage = {
                    id: newId(),
                    role: 'assistant',
                    content: result.message,
                    suggestions: result.suggestions as ChatMessage['suggestions'],
                    timestamp: new Date().toISOString(),
                };
                addMessage(msg);
            } finally {
                setAnalyzing(false);
            }
        }, 800);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [selectedPath, addMessage, clearMessages, setAnalyzing, setOllamaAvailable]);
}
