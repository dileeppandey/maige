import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import type { ChatMessage } from '../../shared/types';

/** Set to true to automatically analyse every image as soon as it is opened. */
const AUTO_ANALYSE_ON_OPEN = false;

function newId() {
    return Math.random().toString(36).slice(2);
}

export function useSceneAnalysis(selectedPath: string | null) {
    const analyzedPaths = useRef<Set<string>>(new Set());
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Tracks the most-recently-selected path so async callbacks can detect staleness
    const currentPathRef = useRef<string | null>(null);

    const addMessage = useChatStore((s) => s.addMessage);
    const setAnalyzing = useChatStore((s) => s.setAnalyzing);
    const setOllamaAvailable = useChatStore((s) => s.setOllamaAvailable);

    // Check Ollama on mount
    useEffect(() => {
        window.api.checkOllamaStatus().then((ok: boolean) => {
            setOllamaAvailable(ok);
        });
    }, [setOllamaAvailable]);

    useEffect(() => {
        // Always update the ref so in-flight callbacks can detect a switch
        currentPathRef.current = selectedPath;

        if (!selectedPath) return;

        // Clear previous timer
        if (timerRef.current) clearTimeout(timerRef.current);

        // NOTE: do NOT call clearMessages() here — ChatPanel loads DB history for the
        // selected image asynchronously. Clearing here would race with and wipe that load.

        if (!AUTO_ANALYSE_ON_OPEN) return;
        if (analyzedPaths.current.has(selectedPath)) return;

        timerRef.current = setTimeout(async () => {
            // Capture path so we can detect if the user switched while awaiting
            const pathAtStart = selectedPath;

            const available = await window.api.checkOllamaStatus() as boolean;
            setOllamaAvailable(available);
            if (!available) return;

            // Stale check after first await
            if (pathAtStart !== currentPathRef.current) return;

            analyzedPaths.current.add(pathAtStart);
            setAnalyzing(true);

            try {
                const result = await window.api.analyzeImageScene(pathAtStart) as {
                    message: string;
                    adjustments: null;
                    suggestions: Array<{ label: string; adjustments: Record<string, number> }>;
                };

                // Stale check after second (slow) await
                if (pathAtStart !== currentPathRef.current) return;

                // Only add the message if we got actual suggestions (skip Ollama error responses)
                if (!result.suggestions?.length && !result.adjustments) return;

                const msg: ChatMessage = {
                    id: newId(),
                    role: 'assistant',
                    content: result.message,
                    suggestions: result.suggestions as ChatMessage['suggestions'],
                    timestamp: new Date().toISOString(),
                };
                addMessage(msg);

                // Persist the scene-analysis message so it reloads on next visit
                window.api.saveChatMessage({
                    id: msg.id,
                    imagePath: pathAtStart,
                    role: msg.role,
                    content: msg.content,
                    suggestions: result.suggestions?.length ? JSON.stringify(result.suggestions) : null,
                    timestamp: msg.timestamp,
                });
            } finally {
                if (pathAtStart === currentPathRef.current) setAnalyzing(false);
            }
        }, 800);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [selectedPath, addMessage, setAnalyzing, setOllamaAvailable]);
}
